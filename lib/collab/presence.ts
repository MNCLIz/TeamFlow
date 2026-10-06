/**
 * 协作文档的在线状态（presence）——进程内登记表，仅用于日志与后续的在线用户展示。
 *
 * 注意：这是**文档级**在线状态，不是项目级在线用户；真正的光标/选区信息走 Yjs awareness，
 * 由 Hocuspocus 内部转发，不经过这里。
 *
 * 以 socketId 为键：一个用户可能有多个连接（多标签页 / 多设备），按 socket 去重比按用户计数可靠。
 */

export interface PresenceUser {
  userId: string;
  name: string | null;
  image: string | null;
  readOnly: boolean;
}

const KEY = "__dsh_collab_presence__";
const DOCS_KEY = "__dsh_collab_documents__";

type DocumentRegistry = Map<string, Map<string, PresenceUser>>;

function registry(): DocumentRegistry {
  const holder = globalThis as unknown as { [KEY]?: DocumentRegistry };
  if (!holder[KEY]) holder[KEY] = new Map();
  return holder[KEY];
}

function documentKeys(): Map<string, string> {
  const holder = globalThis as unknown as { [DOCS_KEY]?: Map<string, string> };
  if (!holder[DOCS_KEY]) holder[DOCS_KEY] = new Map();
  return holder[DOCS_KEY];
}

export function joinDocument(
  documentName: string,
  socketId: string,
  user: PresenceUser,
): void {
  const docs = registry();
  let sockets = docs.get(documentName);
  if (!sockets) {
    sockets = new Map();
    docs.set(documentName, sockets);
  }
  sockets.set(socketId, user);
  documentKeys().set(socketId, documentName);
}

export function leaveDocument(socketId: string): void {
  const docs = registry();
  const documentName = documentKeys().get(socketId);
  if (!documentName) return;

  documentKeys().delete(socketId);
  const sockets = docs.get(documentName);
  if (!sockets) return;

  sockets.delete(socketId);
  if (sockets.size === 0) docs.delete(documentName);
}

/** 当前文档的在线用户（同一用户多连接只算一次） */
export function onlineUsers(documentName: string): PresenceUser[] {
  const sockets = registry().get(documentName);
  if (!sockets) return [];

  const byUser = new Map<string, PresenceUser>();
  for (const user of sockets.values()) {
    const existing = byUser.get(user.userId);
    // 同一用户既有多端时，只要有一端可写就算「在编辑」
    if (!existing || (existing.readOnly && !user.readOnly)) {
      byUser.set(user.userId, user);
    }
  }
  return Array.from(byUser.values());
}

/** 调试/日志用：`project-xxx: alice(编辑), bob(只读)` */
export function describeOnline(documentName: string): string {
  const users = onlineUsers(documentName);
  if (users.length === 0) return `${documentName}: (空)`;
  const names = users.map(
    (user) => `${user.name ?? user.userId}${user.readOnly ? "(只读)" : "(编辑)"}`,
  );
  return `${documentName}: ${names.join(", ")}`;
}
