import { prisma } from "@/lib/prisma";

// 评论文本上限（字符数）
export const MAX_COMMENT_LENGTH = 5000;
// Activity 中保留的评论摘要长度
export const COMMENT_EXCERPT_LENGTH = 50;
// 评论返回体统一携带的作者字段
export const COMMENT_AUTHOR_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

// 评论返回体统一携带的关联用户（作者 + 解决人）
export const COMMENT_INCLUDE = {
  author: { select: COMMENT_AUTHOR_SELECT },
  resolvedBy: { select: COMMENT_AUTHOR_SELECT },
} as const;

export interface CommentScope {
  projectId: string;
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

    // 独立卡片（不属于任何项目）没有成员权限体系，暂不支持评论
    if (!card.projectId) {
      return { error: { status: 400, message: "该卡片不属于任何项目，暂不支持评论" } };
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
