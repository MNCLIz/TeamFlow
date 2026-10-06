import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { parseDocumentName, type DocKey } from "@/lib/collab/doc-key";
import { broadcast } from "@/lib/sse";
import { describeOnline, onlineUsers } from "@/lib/collab/presence";
import { recallReport } from "@/lib/collab/projection";
import {
  decodeStateVector,
  isStaleProjection,
  rememberAcceptedVector,
  stateVectorToMap,
} from "@/lib/collab/projection";
import {
  MAX_DESCRIPTION_BYTES,
  isDescriptionWithinLimit,
  utf8ByteLength,
} from "@/lib/description-limit";

/**
 * 协作文档的持久化（服务端专用，依赖 Prisma）。
 *
 * 数据流：Y.Doc 是权威 → snapshot 落 `Document.yjsState` → 客户端上报的 Markdown 写进
 * `Document.markdown` 并投影回 `Project.description`（供列表页/导出/搜索等既有读取路径）。
 */

const docLocks = new Map<string, Promise<unknown>>();

/** 同一文档的写入串行化（Hocuspocus 的 debounce 不保证 onStoreDocument 串行） */
export function withDocLock<T>(documentName: string, task: () => Promise<T>): Promise<T> {
  const previous = docLocks.get(documentName) ?? Promise.resolve();
  const next = previous.then(task, task);
  docLocks.set(
    documentName,
    next.catch(() => undefined),
  );
  return next;
}

async function findDocumentRow(key: DocKey) {
  return prisma.document.findFirst({
    where: key.kind === "project" ? { projectId: key.id } : { cardId: key.id },
    select: { id: true, version: true, yjsState: true },
  });
}

/**
 * 编码当前 Y.Doc 的全量快照。
 * 用全量而非增量：`MediumBlob` 足够大，逻辑简单且可自愈（增量链一旦缺一环就无法恢复）。
 */
function encodeSnapshot(yDoc: Y.Doc): Uint8Array | null {
  const update = Y.encodeStateAsUpdate(yDoc);
  // 空文档的编码是 2 字节（0 个 struct），没必要落库
  return update.byteLength > 2 ? update : null;
}

/**
 * 文档载入：有快照就恢复，没有就返回 null（内容由编辑器侧的 applyTemplate 用既有的
 * `description` 播种 —— 客户端持有 schema，服务端不重复承担播种逻辑）。
 */
export async function loadDocumentState(
  documentName: string,
): Promise<Uint8Array | null> {
  const key = parseDocumentName(documentName);
  if (!key) return null;

  const row = await findDocumentRow(key);
  if (row?.yjsState && row.yjsState.byteLength > 0) {
    return new Uint8Array(row.yjsState);
  }
  return null;
}

export interface SnapshotResult {
  saved: boolean;
  version: bigint | null;
  /** 无变更或没有可用投影时跳过 */
  reason?: "empty" | "no-change" | "error" | "stale-projection";
}

/**
 * 落库：Y.Doc → `yjsState`，客户端上报的 Markdown → `markdown` + `description` 投影。
 * 由 Hocuspocus 的 `onStoreDocument` 调用（自带 debounce）。
 */
export async function saveDocumentSnapshot(
  documentName: string,
  yDoc: Y.Doc,
): Promise<SnapshotResult> {
  const key = parseDocumentName(documentName);
  if (!key) return { saved: false, version: null, reason: "error" };

  return withDocLock(documentName, async () => {
    try {
      const update = encodeSnapshot(yDoc);
      if (!update) return { saved: false, version: null, reason: "empty" as const };

      const report = recallReport(documentName);
      const row = await findDocumentRow(key);
      // tsconfig 的 target 是 ES2017，不能用 BigInt 字面量
      const nextVersion = BigInt(row?.version ?? 0) + BigInt(1);

      const markdown = report?.markdown ?? null;
      const encoded = Buffer.from(update);

      if (row) {
        await prisma.document.update({
          where: { id: row.id },
          data: {
            yjsState: encoded,
            markdown: markdown ?? undefined,
            version: nextVersion,
          },
        });
      } else {
        await prisma.document.create({
          data: {
            ...(key.kind === "project" ? { projectId: key.id } : { cardId: key.id }),
            yjsState: encoded,
            markdown,
            version: nextVersion,
          },
        });
      }

      // 投影回既有列，保证列表页/导出等读取路径拿到的仍是纯文本。
      // 只有「相对上一次写回明确更旧」的上报才丢（见 projection.ts 的 isStaleProjection）：
      // 多端并发上报时后到的可能是旧视图，直接写回会让 description 丢掉另一个人的编辑。
      let projectionText: string | null = null;
      let projectionStale = false;
      if (markdown !== null) {
        const reportVector = decodeStateVector(report?.stateVector ?? "");
        const reportMap = reportVector ? stateVectorToMap(reportVector) : null;
        if (reportMap && isStaleProjection(documentName, reportMap)) {
          projectionStale = true;
        } else {
          projectionText = await writeProjection(key, markdown);
          if (reportMap) rememberAcceptedVector(documentName, reportMap);
        }
      }

      broadcastDocumentUpdated(key, nextVersion, documentName, projectionText);
      return {
        saved: true,
        version: nextVersion,
        ...(projectionStale ? { reason: "stale-projection" as const } : {}),
      };
    } catch (error) {
      console.error(`[collab] 文档快照落库失败 ${documentName}:`, error);
      return { saved: false, version: null, reason: "error" as const };
    }
  });
}

/**
 * 把 Markdown 投影回 `Project.description` / `Card.description`。
 *
 * 投影列是 MySQL TEXT（65,535 字节）。CRDT 下超限**不能**阻止落库 —— 内容已经在所有人手里，
 * 拒绝写快照等于丢数据（设计稿 §10.1）。所以：`yjsState` 与 `Document.markdown`（MediumText）
 * 照常保存，只有写回既有列时截断，并留下明确的截断标记。
 */
async function writeProjection(key: DocKey, markdown: string): Promise<string> {
  const text = truncatedForColumn(markdown);
  if (text !== markdown) {
    console.warn(
      `[collab] 投影超限，已截断写回 ${key.kind}-${key.id}：` +
        `${utf8ByteLength(markdown)} 字节 → ${utf8ByteLength(text)} 字节`,
    );
  }
  if (key.kind === "project") {
    await prisma.project.update({
      where: { id: key.id },
      data: { description: text },
    });
    return text;
  }
  await prisma.card.update({ where: { id: key.id }, data: { description: text } });
  return text;
}

/** 截断标记：让读投影的人知道这份正文不完整，而不是以为文档就这么短 */
const TRUNCATION_NOTICE = "\n\n> （描述超出长度上限，已截断；完整内容请打开描述编辑器查看）";

function truncatedForColumn(markdown: string): string {
  if (isDescriptionWithinLimit(markdown)) return markdown;
  const noticeBytes = utf8ByteLength(TRUNCATION_NOTICE);
  const budget = MAX_DESCRIPTION_BYTES - noticeBytes;
  // 从预算处往回退，直到 UTF-8 字节数装得下（多字节字符不会在中间被截开）
  let cut = markdown.length;
  while (cut > 0 && utf8ByteLength(markdown.slice(0, cut)) > budget) {
    cut -= 1;
  }
  // 尽量在换行处收尾，避免把一行截成半句
  const lastBreak = markdown.lastIndexOf("\n", cut);
  if (lastBreak > cut - 200 && lastBreak > 0) cut = lastBreak;
  return markdown.slice(0, cut) + TRUNCATION_NOTICE;
}

/**
 * 广播 `doc:updated`：让没有打开编辑器的成员（列表页/首页）也感知文档已变。
 *
 * 载荷带上投影正文（就是写回 `description` 的那份，超限时已被截断）：否则「摘要」类展示
 * 只能重新拉接口才能更新，而走 SSE 的话一次就是最终值。正文上限 65KB，项目级频道可接受。
 */
export function broadcastDocumentUpdated(
  key: DocKey,
  version: bigint,
  documentName: string,
  markdown: string | null,
) {
  if (key.kind !== "project") return; // 独立任务没有项目频道
  broadcast(key.id, "doc:updated", {
    kind: key.kind,
    id: key.id,
    documentName,
    version: Number(version),
    updatedAt: new Date().toISOString(),
    markdown,
    online: onlineUsers(documentName).map((user) => user.userId),
  });
  if (process.env.COLLAB_DEBUG) {
    console.log("[collab] 快照已保存 ·", describeOnline(documentName));
  }
}
