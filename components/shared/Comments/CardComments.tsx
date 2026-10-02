"use client";

import { Badge } from "@/components/ui/badge";
import { CommentComposer } from "@/components/shared/Comments/CommentComposer";
import { CommentList } from "@/components/shared/Comments/CommentList";
import { useComments } from "@/hooks/useComments";
import { CommentScope } from "@/types/comment";

// 卡片详情抽屉内的评论区块：与右侧讨论面板共用列表与输入组件，只是内联排布
export function CardComments({
  cardId,
  projectId,
  currentUserId,
  canModerate,
}: {
  cardId: string;
  projectId: string;
  currentUserId: string;
  // ADMIN 或项目 owner：可删除他人评论（后端同规则）
  canModerate: boolean;
}) {
  const scope: CommentScope = { type: "card", projectId, cardId };
  const { comments, isLoading } = useComments(scope);
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">评论</span>
        {unresolvedCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {unresolvedCount}
          </Badge>
        )}
      </div>

      {/* 抽屉内容区是 overflow-hidden，列表自身限高滚动，避免把描述挤出可视区 */}
      <div className="max-h-80 overflow-y-auto">
        <CommentList
          comments={comments}
          scope={scope}
          currentUserId={currentUserId}
          canModerate={canModerate}
          isLoading={isLoading}
        />
      </div>

      <div className="mt-3">
        <CommentComposer scope={scope} />
      </div>
    </section>
  );
}
