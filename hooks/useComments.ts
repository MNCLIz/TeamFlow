"use client";

import { useEffect } from "react";
import { useCommentStore } from "@/store/commentStore";
import { CommentScope, commentScopeKey } from "@/types/comment";

// 订阅某个作用域（卡片评论 / 项目级讨论）的评论列表，首次挂载时按需拉取
export function useComments(scope: CommentScope) {
  const key = commentScopeKey(scope);
  const projectId = scope.projectId;
  const cardId = scope.type === "card" ? scope.cardId : null;

  const comments = useCommentStore((state) => state.commentsByScope[key]);
  const isLoading = useCommentStore((state) => state.loadingScopes[key] ?? false);
  const fetchComments = useCommentStore((state) => state.fetchComments);

  // 依赖使用原始值，避免 scope 对象每次重建导致重复请求
  useEffect(() => {
    if (comments !== undefined) return;
    const target: CommentScope = cardId
      ? { type: "card", projectId, cardId }
      : { type: "project", projectId };
    fetchComments(target).catch((err) => {
      console.error("[useComments] fetch failed:", err);
    });
  }, [comments, cardId, projectId, fetchComments]);

  return {
    comments: comments ?? [],
    // 尚未加载（undefined）也视为加载中，避免首帧闪出"还没有讨论"空态
    isLoading: comments === undefined || isLoading,
    loaded: comments !== undefined,
  };
}
