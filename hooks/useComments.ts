"use client";

import { useEffect } from "react";
import { useCommentStore } from "@/store/commentStore";
import { CommentScope, commentScopeKey } from "@/types/comment";

// 订阅某个作用域（卡片评论 / 项目级讨论）的评论列表，首次挂载时按需拉取
export function useComments(scope: CommentScope) {
  const key = commentScopeKey(scope);
  const projectId = scope.projectId;
  const cardId = scope.type === "card" ? scope.cardId : null;
  // 项目级讨论必然带 projectId（卡片评论的 projectId 可能为 null，即独立任务）
  const projectScopeId = scope.type === "project" ? scope.projectId : null;

  const comments = useCommentStore((state) => state.commentsByScope[key]);
  const isLoading = useCommentStore((state) => state.loadingScopes[key] ?? false);
  const fetchComments = useCommentStore((state) => state.fetchComments);

  // 依赖使用原始值，避免 scope 对象每次重建导致重复请求
  useEffect(() => {
    if (comments !== undefined) return;
    const target: CommentScope | null = cardId
      ? { type: "card", projectId, cardId }
      : projectScopeId
        ? { type: "project", projectId: projectScopeId }
        : null;
    if (!target) return;
    fetchComments(target).catch((err) => {
      console.error("[useComments] fetch failed:", err);
    });
  }, [comments, cardId, projectId, projectScopeId, fetchComments]);

  return {
    comments: comments ?? [],
    // 尚未加载（undefined）也视为加载中，避免首帧闪出"还没有讨论"空态
    isLoading: comments === undefined || isLoading,
    loaded: comments !== undefined,
  };
}
