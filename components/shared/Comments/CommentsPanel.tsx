"use client";

import { PanelRightClose } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentComposer } from "@/components/shared/Comments/CommentComposer";
import { CommentList } from "@/components/shared/Comments/CommentList";
import { CommentScope, CommentType } from "@/types/comment";

export function CommentsPanel({
  title = "讨论",
  scope,
  comments,
  isLoading,
  currentUserId,
  canModerate,
  onClose,
}: {
  title?: string;
  scope: CommentScope;
  comments: CommentType[];
  isLoading: boolean;
  currentUserId: string;
  canModerate: boolean;
  // 收起按钮：移动端抽屉里不传，由 Sheet 自带的关闭按钮负责
  onClose?: () => void;
}) {
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <span className="text-sm font-semibold">{title}</span>
        {unresolvedCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {unresolvedCount}
          </Badge>
        )}
        <div className="flex-1" />
        {onClose && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="收起讨论面板"
            title="收起"
            onClick={onClose}
          >
            <PanelRightClose className="size-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CommentList
          comments={comments}
          scope={scope}
          currentUserId={currentUserId}
          canModerate={canModerate}
          isLoading={isLoading}
        />
      </div>

      <div className="shrink-0 border-t p-3">
        <CommentComposer scope={scope} />
      </div>
    </div>
  );
}
