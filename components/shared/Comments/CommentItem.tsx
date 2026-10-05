"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, CornerUpLeft, Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/shared/Comments/AutoGrowTextarea";
import { MentionPicker } from "@/components/shared/Comments/MentionPicker";
import { DeleteAlertDialog } from "@/components/shared/DeleteAlertDialog";
import { useMentionInput } from "@/hooks/useMentionInput";
import { splitMentionSegments } from "@/lib/mention";
import { TEMP_COMMENT_PREFIX, useCommentStore } from "@/store/commentStore";
import { CommentScope, CommentType } from "@/types/comment";

// 相对时间：刚刚 / n 分钟前 / n 小时前 / 昨天 / 具体日期
function formatRelativeTime(value: Date | string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function CommentItem({
  comment,
  scope,
  currentUserId,
  canModerate,
  onReply,
}: {
  comment: CommentType;
  scope: CommentScope;
  currentUserId: string;
  // ADMIN 或项目 owner：可删除他人评论（后端同规则）
  canModerate: boolean;
  // 点击"回复"：由容器层决定引用目标（回复的回复会提升为根评论）
  onReply?: (comment: CommentType) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [busy, setBusy] = useState(false);

  const updateComment = useCommentStore((state) => state.updateComment);
  const removeComment = useCommentStore((state) => state.removeComment);

  // 编辑态复用同一套 @提及面板：已存在的提及成员作为种子，正文里还在的会保留
  const mention = useMentionInput({
    value: draft,
    onChange: setDraft,
    projectId: scope.projectId,
    seedUserIds: (comment.mentions ?? []).map((item) => item.userId),
    enabled: editing,
  });

  const isPending = comment.id.startsWith(TEMP_COMMENT_PREFIX);
  const isAuthor = comment.authorId === currentUserId;
  const canDelete = isAuthor || canModerate;
  const authorName =
    comment.author?.name ?? comment.author?.email ?? "未知用户";

  const handleToggleResolved = async () => {
    if (busy || isPending) return;
    setBusy(true);
    try {
      await updateComment(scope, {
        id: comment.id,
        resolved: !comment.resolved,
      });
    } catch (err) {
      toast.error(comment.resolved ? "取消解决失败" : "标记解决失败", {
        position: "top-center",
      });
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    const content = draft.trim();
    if (!content) {
      toast.error("评论内容不能为空", { position: "top-center" });
      return;
    }
    setBusy(true);
    try {
      // 提及与正文一起提交：按最终正文重算位置，服务端全量替换
      await updateComment(scope, {
        id: comment.id,
        content,
        mentions: mention.resolveMentions(content),
      });
      mention.close();
      setEditing(false);
    } catch (err) {
      toast.error("评论更新失败", { position: "top-center" });
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setDraft(comment.content);
    mention.close();
    setEditing(false);
  };

  const handleDelete = (id: string) => {
    removeComment(scope, id).catch((err) => {
      toast.error("评论删除失败", { position: "top-center" });
      console.error(err);
    });
  };

  return (
    <div
      data-slot="comment-item"
      data-comment-id={comment.id}
      className={`group rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/40 ${
        comment.resolved ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Avatar size="sm" className="mt-0.5 shrink-0">
          {comment.author?.image && (
            <AvatarImage src={comment.author.image} alt={authorName} />
          )}
          <AvatarFallback>{authorName[0]}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{authorName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {isPending ? "发送中…" : formatRelativeTime(comment.createdAt)}
            </span>
            {comment.editedAt && !isPending && (
              <span className="shrink-0 text-xs text-muted-foreground">
                已编辑
              </span>
            )}

            {/* 操作按钮：四个等宽等距的 icon-xs（24px）方形按钮，删除按钮保持同样盒模型 */}
            <div
              data-slot="comment-actions"
              className="ml-auto flex shrink-0 items-center gap-1"
            >
              {!isPending && !editing && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {/* 回复按钮 */}
                  {onReply && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="回复评论"
                      title="回复"
                      onClick={() => onReply(comment)}
                    >
                      <CornerUpLeft className="size-4" />
                    </Button>
                  )}

                  {/* 解决按钮 */}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    disabled={busy}
                    aria-label={comment.resolved ? "取消解决" : "标记为已解决"}
                    title={comment.resolved ? "取消解决" : "标记为已解决"}
                    onClick={handleToggleResolved}
                  >
                    <Check
                      className={`size-4 ${comment.resolved ? "text-green-600" : ""}`}
                    />
                  </Button>

                  {/* 编辑按钮 */}
                  {isAuthor && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="编辑评论"
                      title="编辑评论"
                      onClick={() => {
                        setDraft(comment.content);
                        setEditing(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}

                  {/* 删除按钮：DeleteAlertDialog 的触发器自身是 button，这里只给图标套一层与 icon-xs 一致的 24×24 视觉盒 */}
                  {canDelete && (
                    <DeleteAlertDialog
                      id={comment.id}
                      confirmDelete={handleDelete}
                      title="删除这条评论？"
                      description="删除后无法恢复"
                    >
                      <div
                        aria-label="删除评论"
                        title="删除评论"
                        className="flex size-6 items-center justify-center rounded-[min(var(--radius-md),10px)] transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </div>
                    </DeleteAlertDialog>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 引用条：显示在正文上方；parentId 为空但快照存在说明被引用的评论已被删除 */}
          {(comment.quotedExcerpt || comment.quotedAuthorName) && (
            <div
              data-slot="comment-quote"
              className="mt-1 flex items-start gap-1.5 border-l-2 border-border pl-2 text-xs text-muted-foreground"
            >
              <CornerUpLeft className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-1 min-w-0">
                {comment.parentId
                  ? `回复 ${comment.quotedAuthorName ?? "未知用户"}：`
                  : "原评论已删除："}
                {comment.quotedExcerpt}
              </span>
            </div>
          )}

          {/* 编辑模式：轻量输入区，随内容增高；同样支持 @提及面板 */}
          {editing ? (
            <div className="relative mt-1 rounded-lg bg-muted/60 px-2 py-1">
              {mention.picker && (
                <MentionPicker
                  candidates={mention.picker.candidates}
                  activeUserId={mention.picker.activeUserId}
                  onSelect={mention.picker.onSelect}
                  onHighlight={mention.picker.onHighlight}
                />
              )}
              {/* 输入区 */}
              <AutoGrowTextarea
                value={draft}
                autoFocus
                disabled={busy}
                maxHeight={200}
                onChange={setDraft}
                onSelectionChange={mention.onSelectionChange}
                caretRequest={mention.caretRequest}
                onKeyDown={(event) => {
                  if (mention.handleKeyDown(event)) return;
                  if (
                    (event.metaKey || event.ctrlKey) &&
                    event.key === "Enter"
                  ) {
                    event.preventDefault();
                    void handleSaveEdit();
                  }
                  if (event.key === "Escape") {
                    cancelEdit();
                  }
                }}
                className="py-1"
              />
              <div className="flex items-center justify-end gap-1 pt-0.5">
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={busy}
                  onClick={cancelEdit}
                >
                  取消
                </Button>
                <Button size="xs" disabled={busy} onClick={handleSaveEdit}>
                  保存
                </Button>
              </div>
            </div>
          ) : (
            // 评论正文：按数据库里的提及位置高亮被 @ 的成员
            <p
              data-slot="comment-content"
              className="mt-0.5 text-sm break-words whitespace-pre-wrap"
            >
              {splitMentionSegments(comment.content, comment.mentions).map(
                (segment, index) =>
                  segment.userId ? (
                    <span
                      key={index}
                      data-slot="comment-mention"
                      data-user-id={segment.userId}
                      className="rounded-[4px] bg-primary/10 px-1 font-medium text-primary"
                    >
                      {segment.text}
                    </span>
                  ) : (
                    <span key={index}>{segment.text}</span>
                  )
              )}
            </p>
          )}

          {/* 解决状态 */}
          {comment.resolved && !isPending && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="size-3" />
              已解决
              {comment.resolvedBy?.name ? `（${comment.resolvedBy.name}）` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
