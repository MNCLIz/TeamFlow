import { prisma } from "@/lib/prisma";
import { MAX_COMMENT_LENGTH } from "@/lib/comment-text";

// 纯文本常量/工具统一放在 comment-text（客户端可直接引用），此处转出保持既有引用路径可用
export {
  MAX_COMMENT_LENGTH,
  QUOTED_EXCERPT_LENGTH,
  buildQuotedExcerpt,
} from "@/lib/comment-text";

// Activity 中保留的评论摘要长度
export const COMMENT_EXCERPT_LENGTH = 50;
// 评论返回体统一携带的作者字段
export const COMMENT_AUTHOR_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

// 评论返回体统一携带的关联用户（作者 + 解决人 + 被提及成员）
// 提及按正文位置升序下发，前端可直接顺序高亮
export const COMMENT_INCLUDE = {
  author: { select: COMMENT_AUTHOR_SELECT },
  resolvedBy: { select: COMMENT_AUTHOR_SELECT },
  mentions: {
    orderBy: { start: "asc" },
    select: {
      userId: true,
      start: true,
      end: true,
      user: { select: COMMENT_AUTHOR_SELECT },
    },
  },
} as const;

export interface CommentScope {
  // null + cardId 非空：独立任务（不属于任何项目）的评论，没有项目成员体系
  // 非空：项目级讨论（cardId 为 null）或项目内的卡片评论
  projectId: string | null;
  // null 表示项目级讨论，否则为卡片评论
  cardId: string | null;
}

export type CommentScopeResult =
  | { scope: CommentScope }
  | { error: { status: number; message: string } };

// GET / POST 共用的作用域解析：cardId 优先，无 cardId 时为项目级讨论
export async function resolveCommentScope(
  cardId: string | null,
  projectIdParam: string | null
): Promise<CommentScopeResult> {
  if (!cardId && !projectIdParam) {
    return { error: { status: 400, message: "缺少必要参数 cardId 或 projectId" } };
  }

  let projectId = projectIdParam;
  let scopeCardId: string | null = null;

  if (cardId) {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { projectId: true },
    });

    if (!card) {
      return { error: { status: 404, message: "卡片不存在" } };
    }

    // 独立任务（不属于任何项目）：作用域没有项目，权限看任务创建者/负责人
    if (!card.projectId) {
      if (projectId) {
        return { error: { status: 400, message: "卡片与项目不匹配" } };
      }
      return { scope: { projectId: null, cardId } };
    }

    if (projectId && projectId !== card.projectId) {
      return { error: { status: 400, message: "卡片与项目不匹配" } };
    }

    projectId = card.projectId;
    scopeCardId = cardId;
  }

  // 无 cardId 时 projectId 由入口校验保证非空，此处仅做类型收窄
  if (!projectId) {
    return { error: { status: 400, message: "缺少必要参数 cardId 或 projectId" } };
  }

  return { scope: { projectId, cardId: scopeCardId } };
}

// 由已落库的评论反推作用域（PATCH / DELETE 用）：独立任务评论为 projectId 为空 + cardId 非空
export function commentScopeOf(comment: {
  projectId: string | null;
  cardId: string | null;
}): CommentScope | null {
  if (comment.projectId) {
    return { projectId: comment.projectId, cardId: comment.cardId };
  }
  if (comment.cardId) {
    return { projectId: null, cardId: comment.cardId };
  }
  return null;
}

export type CommentAccessResult =
  | {
      ok: true;
      // 能否删除他人评论：项目 ADMIN / 项目 owner，独立任务为任务创建者（后端 DELETE 与此一致）
      canModerate: boolean;
    }
  | { ok: false; status: number; message: string };

// 评论作用域的访问校验：
// - 项目评论（项目级讨论 / 项目内卡片评论）：必须是项目成员
// - 独立任务评论：任务创建者与负责人可访问（与 GET /api/cards 的可见范围一致）
export async function checkCommentScopeAccess(
  scope: CommentScope,
  userId: string
): Promise<CommentAccessResult> {
  if (scope.projectId) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId: scope.projectId } },
      select: { role: true },
    });

    if (!member) {
      return { ok: false, status: 403, message: "无权访问该项目" };
    }

    if (member.role === "ADMIN") {
      return { ok: true, canModerate: true };
    }

    const project = await prisma.project.findUnique({
      where: { id: scope.projectId },
      select: { ownerId: true },
    });

    return { ok: true, canModerate: project?.ownerId === userId };
  }

  // 独立任务：作用域必然带 cardId（resolveCommentScope / commentScopeOf 保证）
  const cardId = scope.cardId;
  if (!cardId) {
    return { ok: false, status: 400, message: "缺少必要参数 cardId 或 projectId" };
  }

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { createdById: true, assigneeId: true },
  });

  if (!card) {
    return { ok: false, status: 404, message: "卡片不存在" };
  }

  if (card.createdById !== userId && card.assigneeId !== userId) {
    return { ok: false, status: 403, message: "无权访问该任务" };
  }

  return { ok: true, canModerate: card.createdById === userId };
}

// 评论正文校验：返回 trim 后的内容或错误信息
export function validateCommentContent(
  content: unknown
): { content: string } | { error: string } {
  if (typeof content !== "string" || content.trim().length === 0) {
    return { error: "评论内容不能为空" };
  }
  const trimmed = content.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { error: `评论内容不能超过 ${MAX_COMMENT_LENGTH} 字` };
  }
  return { content: trimmed };
}

// 客户端提交的一条提及：正文里「@名字」的位置（左闭右开）
export interface CommentMentionInput {
  userId: string;
  start: number;
  end: number;
}

// 提及成员校验
// 0) 独立任务（projectId 为 null）没有项目成员，不允许提及
// 1) 形状：{ userId, start, end }，start/end 为整数且 0 <= start < end <= 正文长度
// 2) 成员：userId 必须属于该项目
// 3) 内容：content.slice(start, end) 必须等于 "@" + 用户名，保证位置与正文永不失配
// 返回按位置升序、精确重复已去重的提及列表
export async function validateMentions(
  mentions: unknown,
  projectId: string | null,
  content: string
): Promise<
  { mentions: CommentMentionInput[] } | { error: { status: number; message: string } }
> {
  if (mentions === undefined || mentions === null) return { mentions: [] };

  if (!Array.isArray(mentions)) {
    return { error: { status: 400, message: "参数 mentions 必须为 { userId, start, end } 数组" } };
  }
  if (mentions.length === 0) return { mentions: [] };

  // 独立任务没有成员可提及：直接拒绝，避免服务端默默丢掉客户端提交的提及
  if (!projectId) {
    return { error: { status: 400, message: "该任务不属于任何项目，不支持 @提及" } };
  }

  const items: CommentMentionInput[] = [];
  for (const raw of mentions) {
    const item = raw as { userId?: unknown; start?: unknown; end?: unknown } | null;
    const valid =
      item !== null &&
      typeof item === "object" &&
      typeof item.userId === "string" &&
      item.userId.length > 0 &&
      Number.isInteger(item.start) &&
      Number.isInteger(item.end) &&
      (item.start as number) >= 0 &&
      (item.end as number) > (item.start as number);

    if (!valid) {
      return {
        error: { status: 400, message: "参数 mentions 必须为 { userId, start, end } 数组" },
      };
    }

    const { userId, start, end } = item as CommentMentionInput;
    if (end > content.length) {
      return { error: { status: 400, message: "提及位置超出正文范围" } };
    }

    items.push({ userId, start, end });
  }

  // 去掉完全重复的提交；同一位置指向不同内容属于自相矛盾，直接拒绝
  const deduped = new Map<number, CommentMentionInput>();
  for (const item of items) {
    const exist = deduped.get(item.start);
    if (!exist) {
      deduped.set(item.start, item);
    } else if (exist.userId !== item.userId || exist.end !== item.end) {
      return { error: { status: 400, message: "提及位置重复" } };
    }
  }

  const unique = [...deduped.values()].sort((a, b) => a.start - b.start);

  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { in: unique.map((m) => m.userId) } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  const membersById = new Map(members.map((m) => [m.userId, m]));

  for (const mention of unique) {
    const member = membersById.get(mention.userId);
    if (!member) {
      return { error: { status: 400, message: "被提及的用户不是项目成员" } };
    }

    const name = member.user?.name ?? member.user?.email ?? "";
    if (content.slice(mention.start, mention.end) !== `@${name}`) {
      return { error: { status: 400, message: "提及位置与正文中的 @名字 不匹配" } };
    }
  }

  return { mentions: unique };
}
