"use client";

import { Badge } from "@/components/ui/badge";
import { CommentComposer } from "@/components/shared/Comments/CommentComposer";
import { CommentList } from "@/components/shared/Comments/CommentList";
import { useComments } from "@/hooks/useComments";
import { useReplyTarget } from "@/hooks/useReplyTarget";
import { CommentScope } from "@/types/comment";

// 卡片详情抽屉内的评论区块：与右侧讨论面板共用列表与输入组件，只是内联排布
// projectId 为 null 表示独立任务（不属于任何项目）：没有 @提及
export function CardComments({
  cardId,
  projectId,
  currentUserId,
  canModerate,
}: {
  cardId: string;
  projectId: string | null;
  currentUserId: string;
  // 项目 ADMIN / 项目 owner，或独立任务创建者：可删除他人评论（后端同规则）
  canModerate: boolean;
}) {
  const scope: CommentScope = { type: "card", projectId, cardId };
  const { comments, isLoading } = useComments(scope);
  const { replyTo, startReply, clearReply } = useReplyTarget(comments);
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">评论</h2>
        {unresolvedCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {unresolvedCount}
          </Badge>
        )}
      </div>

      {/* 无评论时不渲染列表与占位文案，只留输入框 */}
      {comments.length > 0 && (
        <CommentList
          comments={comments}
          scope={scope}
          currentUserId={currentUserId}
          canModerate={canModerate}
          isLoading={isLoading}
          showEmptyState={false}
          onReply={startReply}
        />
      )}

      <div className={comments.length > 0 ? "mt-2" : ""}>
        <CommentComposer
          scope={scope}
          replyTo={replyTo}
          onClearReply={clearReply}
        />
      </div>
    </section>
  );
}
