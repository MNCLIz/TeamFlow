import { UserType } from "@/types/user";

// 评论作用域：cardId 为 null 表示项目级讨论，否则为卡片评论
export interface CommentType {
  id: string;
  content: string;
  projectId: string;
  cardId: string | null;
  authorId: string;
  author: UserType;
  resolved: boolean;
  resolvedAt: Date | null;
  resolvedById: string | null;
  // 解决人（后端 include 下发），未解决时为 null
  resolvedBy?: UserType | null;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentScope =
  | { type: "card"; projectId: string; cardId: string }
  | { type: "project"; projectId: string };

// 前端 store / SSE 分发用的作用域唯一键
export function commentScopeKey(scope: CommentScope): string {
  return scope.type === "card" ? `card:${scope.cardId}` : `project:${scope.projectId}`;
}
