"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CommentItem } from "@/components/shared/Comments/CommentItem";
import { CommentScope, CommentType } from "@/types/comment";

export function CommentList({
  comments,
  scope,
  currentUserId,
  canModerate,
  isLoading,
}: {
  comments: CommentType[];
  scope: CommentScope;
  currentUserId: string;
  canModerate: boolean;
  isLoading: boolean;
}) {
  const [showResolved, setShowResolved] = useState(false);

  const unresolved = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  if (isLoading && comments.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        还没有讨论，写下第一条评论吧
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {unresolved.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          没有未解决的评论
        </div>
      ) : (
        unresolved.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            scope={scope}
            currentUserId={currentUserId}
            canModerate={canModerate}
          />
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
              />
            ))}
        </div>
      )}
    </div>
  );
}
