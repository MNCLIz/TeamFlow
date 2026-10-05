// 评论相关的纯文本工具与常量：不依赖 Prisma，客户端与服务端都可引用

// 评论文本上限（字符数）
export const MAX_COMMENT_LENGTH = 5000;
// 引用条里保存的被引用内容快照长度
export const QUOTED_EXCERPT_LENGTH = 120;

// 被引用内容快照：超长时截断并加省略号
export function buildQuotedExcerpt(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > QUOTED_EXCERPT_LENGTH
    ? `${trimmed.slice(0, QUOTED_EXCERPT_LENGTH)}…`
    : trimmed;
}

// ===== 未读（项目级讨论）=====

// 已读水位线：值为「已读到的最后一条评论的 createdAt」，为空表示从未读过
export type CommentReadWatermark = string | Date | null | undefined;

// 未读判定只需要这三个字段，CommentType 结构上兼容
interface UnreadCandidate {
  createdAt: string | Date;
  resolved: boolean;
  authorId: string;
}

// 解析时间；非法值返回 null（等同于「从未读过」，宁可多提示也不吞掉未读）
function timeOf(value: string | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// 是否为「我还没读过」的评论：
// - 晚于水位线（水位线为空表示全部未读）
// - 未被解决（被解决即视为已处理，不再提示）
// - 不是我自己发的
export function isUnreadComment(
  comment: UnreadCandidate,
  watermark: CommentReadWatermark,
  currentUserId: string
): boolean {
  if (comment.resolved) return false;
  if (comment.authorId === currentUserId) return false;
  const mark = timeOf(watermark);
  if (mark === null) return true;
  const created = timeOf(comment.createdAt);
  if (created === null) return false;
  return created > mark;
}

export function countUnreadComments(
  comments: UnreadCandidate[],
  watermark: CommentReadWatermark,
  currentUserId: string
): number {
  return comments.filter((c) => isUnreadComment(c, watermark, currentUserId)).length;
}

// 列表里最新一条评论的时间（ISO 字符串）：推进水位线用，取自服务端生成的 createdAt
export function latestCommentCreatedAt(
  comments: Pick<UnreadCandidate, "createdAt">[]
): string | null {
  let latest: number | null = null;
  for (const comment of comments) {
    const time = timeOf(comment.createdAt);
    if (time === null) continue;
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? null : new Date(latest).toISOString();
}
