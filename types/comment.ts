import { UserType } from "@/types/user";

// 评论里被 @ 提及的成员（后端 include 下发，按正文位置升序）
// start/end 为正文的 JS UTF-16 下标（左闭右开）：content.slice(start, end) === "@" + user.name
export interface CommentMentionType {
  userId: string;
  start: number;
  end: number;
  user: UserType;
}

// 提交提及时的入参（位置由输入框的 @选择 计算得出）
export interface CommentMentionInput {
  userId: string;
  start: number;
  end: number;
}

// 评论作用域：cardId 为 null 表示项目级讨论，否则为卡片评论
export interface CommentType {
  id: string;
  content: string;
  // 独立任务（不属于任何项目）的评论为 null
  projectId: string | null;
  cardId: string | null;
  authorId: string;
  author: UserType;
  resolved: boolean;
  resolvedAt: Date | null;
  resolvedById: string | null;
  // 解决人（后端 include 下发），未解决时为 null
  resolvedBy?: UserType | null;
  editedAt: Date | null;
  // 引用（回复）：parentId 指向根评论；为空表示普通评论，或所引用的评论已被删除
  parentId: string | null;
  // 引用快照：parentId 为空但有快照时，说明被引用的评论已被删除
  quotedAuthorName: string | null;
  quotedExcerpt: string | null;
  // 被 @ 提及的成员（后端 include 下发；乐观插入的临时评论可能缺失）
  mentions?: CommentMentionType[];
  createdAt: Date;
  updatedAt: Date;
}

// 评论作用域：
// - type "card"：卡片评论，projectId 为 null 表示独立任务（不属于任何项目，没有成员与 @提及）
// - type "project"：项目级讨论
export type CommentScope =
  | { type: "card"; projectId: string | null; cardId: string }
  | { type: "project"; projectId: string };

// 前端 store / SSE 分发用的作用域唯一键
export function commentScopeKey(scope: CommentScope): string {
  return scope.type === "card" ? `card:${scope.cardId}` : `project:${scope.projectId}`;
}
