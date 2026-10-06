import { prisma } from "@/lib/prisma";
import { parseDocumentName, toDocumentName, type DocKey } from "@/lib/collab/doc-key";

/**
 * 协作文档的权限判定（服务端专用，依赖 Prisma）。
 *
 * 与既有的粗粒度角色保持一致：owner 与 ADMIN 可写，MEMBER 只读。
 * 只读必须在**服务端**成立（WS 消息客户端可伪造），前端的 editable=false 只是体验层。
 */

export interface DocAccess {
  key: DocKey;
  /** 可以读到实时内容（项目成员一律为 true） */
  canRead: boolean;
  /** 可以写入（owner / ADMIN） */
  canWrite: boolean;
  /** 项目内的角色：owner 在 ProjectMember 里可能没有行，这里按 ADMIN 处理 */
  role: "OWNER" | "ADMIN" | "MEMBER";
}

/**
 * 阶段 1/2 的协作范围：仅项目描述。
 * 卡片描述（`card-<id>`）的协作在后续阶段开放；届时把 "card" 加进这个集合，
 * 并补上独立任务（projectId 为 null）的「创建者 / 负责人」判定分支即可。
 */
export const COLLAB_DOC_KINDS: ReadonlyArray<DocKey["kind"]> = ["project"];

/** documentName → 访问信息；格式非法、文档不存在、无权访问均返回 null */
export async function checkDocAccess(
  documentName: string,
  userId: string,
): Promise<DocAccess | null> {
  const key = parseDocumentName(documentName);
  if (!key) return null;
  if (!COLLAB_DOC_KINDS.includes(key.kind)) return null;

  if (key.kind === "card") {
    // 预留：卡片描述（含独立任务）的权限分支
    const card = await prisma.card.findUnique({
      where: { id: key.id },
      select: { projectId: true, createdById: true, assigneeId: true },
    });
    if (!card) return null;

    if (!card.projectId) {
      // 独立任务：只有任务创建者与负责人可读写（与评论的判定一致）
      const isParticipant =
        card.createdById === userId || card.assigneeId === userId;
      if (!isParticipant) return null;
      return { key, canRead: true, canWrite: true, role: "OWNER" };
    }

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: card.projectId } },
      select: { role: true, project: { select: { ownerId: true } } },
    });
    if (!membership) return null;
    const isOwner = membership.project.ownerId === userId;
    const isAdmin = isOwner || membership.role === "ADMIN";
    return {
      key,
      canRead: true,
      canWrite: isAdmin,
      role: isOwner ? "OWNER" : isAdmin ? "ADMIN" : "MEMBER",
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: key.id },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!project) return null;

  const membership = project.members[0];
  const isOwner = project.ownerId === userId;
  // owner 在 ProjectMember 里可能没有行（创建项目时默认会给一行 ADMIN，但不能依赖它）
  if (!membership && !isOwner) return null;

  const isAdmin = isOwner || membership?.role === "ADMIN";
  return {
    key,
    canRead: true,
    canWrite: isAdmin,
    role: isOwner ? "OWNER" : isAdmin ? "ADMIN" : "MEMBER",
  };
}

/** 便于日志与错误信息使用的展示名 */
export function describeDoc(key: DocKey): string {
  return toDocumentName(key);
}
