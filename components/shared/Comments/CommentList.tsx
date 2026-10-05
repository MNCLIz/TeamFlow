"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CommentItem } from "@/components/shared/Comments/CommentItem";
import { CommentScope, CommentType } from "@/types/comment";

export function CommentList({
  comments,
  scope,
  currentUserId,
  canModerate,
  isLoading,
  // 卡片内联区块不需要占位文案：无评论时只保留输入框
  showEmptyState = true,
  // 未读起点（打开项目时服务端算好的第一条未读评论 id）：传入即启用分割线，卡片评论不传因而不显示
  unreadAnchorId,
  onReply,
}: {
  comments: CommentType[];
  scope: CommentScope;
  currentUserId: string;
  canModerate: boolean;
  isLoading: boolean;
  showEmptyState?: boolean;
  unreadAnchorId?: string | null;
  onReply?: (comment: CommentType) => void;
}) {
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  if (comments.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        {isLoading ? "加载中…" : "还没有讨论，写下第一条评论吧"}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {unresolved.length === 0 ? (
        showEmptyState && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            没有未解决的评论
          </div>
        )
      ) : (
        unresolved.map((comment) => (
          <Fragment key={comment.id}>
            {/* 未读起点由服务端在打开项目时确定：本次会话内固定，展开面板读完后也不跳走 */}
            {comment.id === unreadAnchorId && <UnreadDivider />}
            <CommentItem
              comment={comment}
              scope={scope}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onReply={onReply}
            />
          </Fragment>
        ))
      )}

      {resolved.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {showResolved ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            已解决 ({resolved.length})
          </button>

          {showResolved &&
            resolved.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                scope={scope}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onReply={onReply}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// 未读分割线：标记"以下为未读消息"，只在打开项目时按水位线快照定位
function UnreadDivider() {
  return (
    <div
      data-slot="comment-unread-divider"
      className="my-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground"
    >
      <span className="h-px flex-1 bg-muted-foreground/40" />
      以下为未读消息
      <span className="h-px flex-1 bg-muted-foreground/40" />
    </div>
  );
}
