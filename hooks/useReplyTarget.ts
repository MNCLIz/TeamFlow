"use client";

import { useState } from "react";
import { CommentType } from "@/types/comment";

// 回复目标管理：回复"某条回复"时把目标提升为它的根评论，
// 与服务端写入的引用快照规则保持一致（避免乐观项与落库结果不一致）
export function useReplyTarget(comments: CommentType[]) {
  const [replyTo, setReplyTo] = useState<CommentType | null>(null);

  const startReply = (comment: CommentType) => {
    const rootId = comment.parentId ?? comment.id;
    setReplyTo(comments.find((c) => c.id === rootId) ?? comment);
  };

  const clearReply = () => setReplyTo(null);

  return { replyTo, startReply, clearReply };
}
