"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "cn";

// 评论输入框：无边框、随内容自动增高，超过上限后内部滚动
// 另外向父级上报"当前文本 + 光标位置"（@提及面板据此判断是否展开/如何筛选），
// 并支持父级在插入提及后把光标放回指定位置（受控 textarea 改 value 后光标会跳到末尾）
export function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  onSelectionChange,
  caretRequest = null,
  placeholder,
  autoFocus = false,
  disabled = false,
  maxHeight = 160,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelectionChange?: (text: string, caret: number) => void;
  caretRequest?: { position: number; nonce: number } | null;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  maxHeight?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 先归零再按 scrollHeight 设置，保证删字后也会回缩
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  // nonce 变化即重新定位光标：同一个位置连续插入两次也能生效
  const caretNonce = caretRequest?.nonce;
  useEffect(() => {
    const el = ref.current;
    if (!el || !caretRequest) return;
    el.focus();
    el.setSelectionRange(caretRequest.position, caretRequest.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只按 nonce 触发，position 取最新值即可
  }, [caretNonce]);

  const reportSelection = () => {
    const el = ref.current;
    if (!el || !onSelectionChange) return;
    onSelectionChange(el.value, el.selectionStart ?? el.value.length);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      autoFocus={autoFocus}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
        onSelectionChange?.(
          event.target.value,
          event.target.selectionStart ?? event.target.value.length
        );
      }}
      onKeyDown={onKeyDown}
      onSelect={reportSelection}
      onKeyUp={reportSelection}
      onClick={reportSelection}
      className={cn(
        "w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:outline-none disabled:opacity-60",
        className
      )}
    />
  );
}
