"use client";

import { useState } from "react";
import { SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AutoGrowTextarea } from "@/components/shared/Comments/AutoGrowTextarea";
import { CommentScope } from "@/types/comment";
import { useCommentStore } from "@/store/commentStore";

// 轻量评论输入区：无边框、随内容增高，发送按钮仅在悬停/聚焦时出现
export function CommentComposer({
  scope,
  placeholder = "写下评论…",
  autoFocus = false,
}: {
  scope: CommentScope;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createComment = useCommentStore((state) => state.createComment);

  const submit = async () => {
    const content = value.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    // 立即清空输入框，避免与乐观插入的评论重复显示
    setValue("");
    try {
      // 乐观插入：失败时 store 会回滚，这里负责提示并恢复用户输入
      await createComment(scope, content);
    } catch (err) {
      setValue(content);
      toast.error("评论发送失败", { position: "top-center" });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="group/composer flex items-end gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted/60 focus-within:bg-muted/60">
      <AutoGrowTextarea
        value={value}
        autoFocus={autoFocus}
        disabled={submitting}
        placeholder={placeholder}
        onChange={setValue}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
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
  );
}
