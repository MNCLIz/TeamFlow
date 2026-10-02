"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { cn } from "cn";

// 评论输入框：无边框、随内容自动增高，超过上限后内部滚动
export function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  autoFocus = false,
  disabled = false,
  maxHeight = 160,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
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

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      autoFocus={autoFocus}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className={cn(
        "w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:outline-none disabled:opacity-60",
        className
      )}
    />
  );
}
