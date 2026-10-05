"use client";

import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { MentionCandidate } from "@/lib/mention";

// @提及选择面板：跟随输入框上方展开，键盘（↑↓/Enter/Tab/Esc）由输入框处理，
// 面板只负责展示与鼠标选择，因此焦点始终留在正文里（不跳焦点，正文连打即筛选）
export function MentionPicker({
  candidates,
  activeUserId,
  onSelect,
  onHighlight,
  className,
}: {
  candidates: MentionCandidate[];
  activeUserId: string | null;
  onSelect: (candidate: MentionCandidate) => void;
  onHighlight: (userId: string | null) => void;
  className?: string;
}) {
  return (
    <div
      data-slot="mention-picker"
      className={cn(
        "absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md",
        className
      )}
    >
      <Command
        // 过滤由 lib/mention 完成（要支持拼音序与前缀优先），此处关闭 cmdk 自带过滤
        shouldFilter={false}
        value={activeUserId ?? ""}
        onValueChange={(value) => onHighlight(value || null)}
        className="bg-transparent p-0"
      >
        <CommandList className="max-h-56 p-1" data-slot="mention-list">
          <CommandEmpty className="py-4 text-xs text-muted-foreground">
            没有匹配的成员
          </CommandEmpty>
          {candidates.map((candidate) => (
            <CommandItem
              key={candidate.userId}
              value={candidate.userId}
              onSelect={() => onSelect(candidate)}
              className="gap-2 px-2 py-1.5"
            >
              <Avatar size="sm" className="size-5 shrink-0">
                {candidate.image && (
                  <AvatarImage src={candidate.image} alt={candidate.label} />
                )}
                <AvatarFallback className="text-[10px]">
                  {candidate.label[0]}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
              {candidate.email && (
                <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                  {candidate.email}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
