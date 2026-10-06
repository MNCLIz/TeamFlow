/**
 * 协作文档的标识与命名（纯函数，客户端可安全引用，禁止引入 Prisma）
 *
 * 命名格式：`${kind}-${id}`，例如 `project-clx123`。
 * 它是 Hocuspocus 的 documentName，也是 WebSocket URL 的最后一段。
 */

export type DocKind = "project" | "card";

export interface DocKey {
  kind: DocKind;
  id: string;
}

const DOC_KINDS: DocKind[] = ["project", "card"];

/** cuid 形态的 id：字母数字，长度受限；用白名单避免把任意字符串带进数据库查询与 URL */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** DocKey → documentName */
export function toDocumentName(key: DocKey): string {
  return `${key.kind}-${key.id}`;
}

/** documentName → DocKey；格式非法返回 null（不抛错，交由调用方 404 / 拒绝连接） */
export function parseDocumentName(documentName: string): DocKey | null {
  const separator = documentName.indexOf("-");
  if (separator === -1) return null;

  const kind = documentName.slice(0, separator) as DocKind;
  const id = documentName.slice(separator + 1);

  if (!DOC_KINDS.includes(kind)) return null;
  if (!ID_PATTERN.test(id)) return null;

  return { kind, id };
}
