import type {
  afterUnloadDocumentPayload,
  connectedPayload,
  onAuthenticatePayload,
  onDisconnectPayload,
  onLoadDocumentPayload,
  onStatelessPayload,
  onStoreDocumentPayload,
} from "@hocuspocus/server";
import { resolveUserFromCookie, type CollabUser } from "@/lib/collab/auth-cookie";
import { checkDocAccess, type DocAccess } from "@/lib/collab/doc-access";
import { joinDocument, leaveDocument, describeOnline } from "@/lib/collab/presence";
import { parseDocumentName } from "@/lib/collab/doc-key";
import { loadDocumentState, saveDocumentSnapshot } from "@/lib/collab/document-service";
import {
  forgetAcceptedVector,
  forgetReport,
  parseProjectionReport,
  rememberReport,
  decodeStateVector,
} from "@/lib/collab/projection";

/** 客户端上报的投影载荷上限（正常描述远小于此；防止恶意/异常载荷占用内存） */
const MAX_REPORT_BYTES = 512 * 1024;

/** 连接上下文：`onAuthenticate` 的返回值会透传到后续每个钩子 */
export interface CollabContext {
  user: CollabUser;
  access: DocAccess;
  /** MEMBER 角色：可以同步到最新内容，但不能写入 */
  readOnly: boolean;
}

/**
 * Hocuspocus 的服务端钩子：鉴权 → 权限 → presence → 载入/落库 → 投影上报。
 *
 * 与 WS 服务器（`server.ts`）分开，便于单测与将来换 transport。
 *
 * ## 只读为什么**不**额外拦截写入消息
 *
 * Hocuspocus 用 `connectionConfig.readOnly` 自己兜底（见 server 的 `readSyncMessage`）：
 * 只读连接发 sync step2 时，它会用文档快照做 `snapshotContainsUpdate` 判断 —— 只承认
 * 「自己已经有的内容」（幂等回执），其余一律回 `SyncStatus=false` 且不落文档。
 *
 * 阶段 2 曾在这里加过一层「拦非 step1 的 sync 消息」的钩子，结果是**只读连接在握手阶段
 * 发 sync step2 时被抛错、连接被服务端直接关掉**，表现成「MEMBER 能看到初始内容、但再也
 * 收不到任何实时更新」（实测：只读端 WS 帧数停在 5/4 不动）。协议层已经覆盖这个语义，
 * 这里不要再重复实现。
 */
export const collabHooks = {
  async onAuthenticate({
    documentName,
    requestHeaders,
    connectionConfig,
  }: onAuthenticatePayload<CollabContext>): Promise<CollabContext> {
    if (!parseDocumentName(documentName)) {
      throw new Error("文档标识不合法");
    }

    const user = await resolveUserFromCookie(requestHeaders.get("cookie"));
    if (!user) {
      throw new Error("未登录");
    }

    const access = await checkDocAccess(documentName, user.id);
    if (!access) {
      throw new Error("无权访问该文档");
    }

    // readOnly 交给 Hocuspocus 自己记账：它会拒收该连接的写入并回 PermissionDenied
    connectionConfig.readOnly = !access.canWrite;

    return {
      user,
      access,
      readOnly: !access.canWrite,
    };
  },

  /** 文档载入：有 Yjs 快照就恢复；没有则由客户端的 applySeed 用既有描述播种 */
  async onLoadDocument({ documentName }: onLoadDocumentPayload<CollabContext>) {
    const state = await loadDocumentState(documentName);
    if (state) {
      console.log(`[collab] 载入快照 ${documentName}（${state.byteLength} 字节）`);
    }
    return state;
  },

  async connected({ documentName, context, socketId }: connectedPayload<CollabContext>) {
    if (!context) return;
    joinDocument(documentName, socketId, {
      userId: context.user.id,
      name: context.user.name,
      image: context.user.image,
      readOnly: context.readOnly,
    });
    console.log("[collab] 连接建立 ·", describeOnline(documentName));
  },

  async onDisconnect({ documentName, socketId }: onDisconnectPayload<CollabContext>) {
    leaveDocument(socketId);
    console.log("[collab] 连接断开 ·", describeOnline(documentName));
  },

  /**
   * 客户端上报的 Markdown 投影（见 lib/collab/projection.ts）。
   * 只缓存，落库交给 onStoreDocument —— 那才是唯一写库的地方。
   */
  async onStateless({ documentName, payload, connection }: onStatelessPayload) {
    // onStatelessPayload 没有顶层 context，鉴权上下文挂在 connection 上
    const context = connection.context as CollabContext | undefined;
    if (context?.readOnly) return;

    if (payload.length > MAX_REPORT_BYTES) {
      console.warn(`[collab] 投影载荷过大，已忽略（${payload.length} 字节）`);
      return;
    }

    const report = parseProjectionReport(payload);
    if (!report) return;

    // 载荷里的 documentName 必须与连接所属文档一致，避免跨文档写投影
    if (report.documentName !== documentName) {
      console.warn(
        `[collab] 投影文档名不匹配（连接 ${documentName} / 载荷 ${report.documentName}），已忽略`,
      );
      return;
    }

    if (!decodeStateVector(report.stateVector)) return;

    rememberReport(report);
  },

  /** 落库：Hocuspocus 自带 debounce（默认 2s，最长 10s） */
  async onStoreDocument({
    documentName,
    document,
  }: onStoreDocumentPayload<CollabContext>) {
    const result = await saveDocumentSnapshot(documentName, document);
    if (result.saved && process.env.COLLAB_DEBUG) {
      console.log(`[collab] 快照落库 ${documentName} v${result.version}`);
    }
  },

  async afterUnloadDocument({ documentName }: afterUnloadDocumentPayload) {
    // 文档卸载后投影缓存没有意义了，避免进程内 Map 无限增长
    forgetReport(documentName);
    forgetAcceptedVector(documentName);
  },
};
