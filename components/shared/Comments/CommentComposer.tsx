"use client";

import { useState } from "react";
import { CornerUpLeft, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/shared/Comments/AutoGrowTextarea";
import { MentionPicker } from "@/components/shared/Comments/MentionPicker";
import { useMentionInput } from "@/hooks/useMentionInput";
import { CommentScope, CommentType } from "@/types/comment";
import { useCommentStore } from "@/store/commentStore";

// 轻量评论输入区：无边框、随内容增高，发送按钮仅在悬停/聚焦时出现
// replyTo 存在时在输入框上方显示引用 chip（引用目标由容器层提升为根评论）
// 输入 @ 后不抢焦点：正文继续输入即筛选候选成员（拼音序），↑↓ 选择、Enter/Tab 插入、Esc 关闭
export function CommentComposer({
  scope,
  placeholder = "写下评论…",
  autoFocus = false,
  replyTo = null,
  onClearReply,
}: {
  scope: CommentScope;
  placeholder?: string;
  autoFocus?: boolean;
  replyTo?: CommentType | null;
  onClearReply?: () => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createComment = useCommentStore((state) => state.createComment);
  const mention = useMentionInput({
    value,
    onChange: setValue,
    projectId: scope.projectId,
  });

  const submit = async () => {
    const content = value.trim();
    if (!content || submitting) return;
    // 位置相对最终入库的正文（已 trim）计算，与服务端校验规则一致
    const mentions = mention.resolveMentions(content);

    setSubmitting(true);
    // 立即清空输入框，避免与乐观插入的评论重复显示
    setValue("");
    mention.close();
    try {
      // 乐观插入：失败时 store 会回滚，这里负责提示并恢复用户输入
      await createComment(scope, content, replyTo?.id ?? null, mentions);
      mention.resetPicked();
      onClearReply?.();
    } catch (err) {
      // 失败时保留"选过的成员"，用户重试不必重新选人
      setValue(content);
      toast.error("评论发送失败", { position: "top-center" });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-slot="comment-composer"
      className="relative rounded-lg bg-muted/40 transition-colors hover:bg-muted/60 focus-within:bg-muted/60"
    >
      {replyTo && (
        <div
          data-slot="reply-chip"
          className="mx-2 mt-1 flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
        >
          <CornerUpLeft className="size-3 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            回复 {replyTo.author?.name ?? replyTo.author?.email ?? "未知用户"}：
            {replyTo.content}
          </span>
          <button
            type="button"
            aria-label="取消回复"
            title="取消回复"
            onClick={onClearReply}
            className="shrink-0 rounded p-0.5 transition-colors hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {mention.picker && (
        <MentionPicker
          candidates={mention.picker.candidates}
          activeUserId={mention.picker.activeUserId}
          onSelect={mention.picker.onSelect}
          onHighlight={mention.picker.onHighlight}
        />
      )}

      <div className="group/composer flex items-end gap-1 px-2 py-1">
        <AutoGrowTextarea
          value={value}
          autoFocus={autoFocus}
          disabled={submitting}
          placeholder={placeholder}
          onChange={setValue}
          onSelectionChange={mention.onSelectionChange}
          caretRequest={mention.caretRequest}
          onKeyDown={(event) => {
            // 面板展开时优先处理选择操作
            if (mention.handleKeyDown(event)) return;

            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
            if (event.key === "Escape" && replyTo) {
              event.preventDefault();
              onClearReply?.();
            }
          }}
          className="py-1"
        />
        {/* 发送按钮容器承载显隐：Button 自带 disabled:opacity-50，直接放在按钮上会被覆盖 */}
        <div
          data-slot="comment-send"
          className="mb-1 flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover/composer:opacity-100 group-focus-within/composer:opacity-100"
        >
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="发送评论"
            title="发送（Ctrl / ⌘ + Enter）"
            disabled={submitting || value.trim().length === 0}
            onClick={submit}
          >
            <SendHorizontal />
          </Button>
        </div>
      </div>
    </div>
  );
}
