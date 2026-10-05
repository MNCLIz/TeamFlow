"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import {
  collectMentions,
  filterMentionCandidates,
  getMentionQuery,
  insertMention,
  sortMentionCandidates,
  toMentionCandidates,
  type MentionCandidate,
  type MentionQuery,
} from "@/lib/mention";
import type { CommentMentionInput, CommentMentionType } from "@/types/comment";

// 评论输入框的 @提及行为（新建评论与编辑评论共用）：
// - 依据"当前文本 + 光标"判断 @上下文，正文连打即筛选（面板不抢焦点）
// - ↑↓ 选择、Enter/Tab 插入、Esc 只关面板
// - 提交时按最终正文重算提及位置（最长名字优先），只保留选择框里选过的成员
// - projectId 为 null（独立任务）时整体关闭：没有项目成员可提及，也不会弹出面板
export function useMentionInput({
  value,
  onChange,
  projectId,
  seedUserIds,
  enabled = true,
}: {
  value: string;
  onChange: (value: string) => void;
  projectId: string | null;
  // 已存在的提及成员（编辑评论时种入，保证不改动的那部分提及不会丢）
  seedUserIds?: string[];
  // 是否加载候选成员（评论列表里未进入编辑态时无需请求成员）
  enabled?: boolean;
}) {
  const mentionEnabled = enabled && !!projectId;
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caretRequest, setCaretRequest] = useState<{
    position: number;
    nonce: number;
  } | null>(null);

  // @上下文放在 ref 里做去重比较：键盘移动光标时不会把高亮重置回第一项
  const mentionRef = useRef<MentionQuery | null>(null);
  // Esc 关闭面板后记下当时的文本+光标，避免紧随其后的 keyup/select 把面板又弹回来
  const dismissedRef = useRef<{ text: string; caret: number } | null>(null);
  const caretNonce = useRef(0);
  const pickedRef = useRef<Set<string>>(new Set(seedUserIds ?? []));

  const members = useProjectMembers(projectId, mentionEnabled);
  const candidates = sortMentionCandidates(toMentionCandidates(members));
  const filtered = mention ? filterMentionCandidates(candidates, mention.query) : [];
  const active =
    filtered.length > 0
      ? filtered[Math.min(activeIndex, filtered.length - 1)]
      : null;

  // 种子成员变化（例如保存后拿到新的 mentions）时重置"选过的成员"；
  // 用字符串做依赖，避免每次渲染都重置、把刚选的人丢掉
  const seedKey = (seedUserIds ?? []).join("|");
  useEffect(() => {
    pickedRef.current = new Set(seedUserIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只按 seedKey 变化重置
  }, [seedKey]);

  const close = () => {
    mentionRef.current = null;
    setMention(null);
    setActiveIndex(0);
  };

  // 文本/光标变化 → 重算 @上下文；只有上下文真的变化时才重置高亮
  const onSelectionChange = (text: string, caret: number) => {
    // 独立任务（无项目）没有可提及的成员，不展开面板
    if (!mentionEnabled) return;
    const next = getMentionQuery(text, caret);
    const prev = mentionRef.current;
    if (
      prev?.start === next?.start &&
      prev?.end === next?.end &&
      prev?.query === next?.query
    ) {
      return;
    }
    const dismissed = dismissedRef.current;
    if (next && dismissed && dismissed.text === text && dismissed.caret === caret) {
      return;
    }
    dismissedRef.current = null;
    mentionRef.current = next;
    setMention(next);
    setActiveIndex(0);
  };

  // 选中成员：把 "@查询词" 替换成 "@名字 "（尾空格用于结束本次提及），并把光标放回正文
  const commit = (candidate: MentionCandidate) => {
    const range = mentionRef.current;
    if (!range) return;
    const next = insertMention(value, range, candidate.name);
    pickedRef.current.add(candidate.userId);
    dismissedRef.current = null;
    onChange(next.text);
    close();
    setCaretRequest({ position: next.caret, nonce: caretNonce.current++ });
  };

  // 返回 true 表示这次按键已被面板消费，调用方不应再处理
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionRef.current && filtered.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % filtered.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + filtered.length) % filtered.length
        );
        return true;
      }
      if (
        (event.key === "Enter" || event.key === "Tab") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        if (active) commit(active);
        return true;
      }
    }

    if (mentionRef.current && event.key === "Escape") {
      // 记下当前文本+光标，避免 keyup 再把面板弹回来
      dismissedRef.current = {
        text: event.currentTarget.value,
        caret: event.currentTarget.selectionStart ?? 0,
      };
      event.preventDefault();
      // 拦住向外的 Esc：Base UI 抽屉在 document 上也监听 Esc（React 19 的根监听同样挂在
      // document 上），不 stopImmediatePropagation 会把整个抽屉关掉、草稿一起丢
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      close();
      return true;
    }

    return false;
  };

  // 按最终（trim 后入库的）正文重算提及，附带用户信息供乐观更新使用
  const resolveMentions = (content: string): CommentMentionType[] =>
    collectMentions(content, candidates, pickedRef.current).map((item) => {
      const candidate = candidates.find((c) => c.userId === item.userId);
      return {
        userId: item.userId,
        start: item.start,
        end: item.end,
        user: {
          id: item.userId,
          name: candidate?.name ?? null,
          email: candidate?.email ?? undefined,
          image: candidate?.image ?? null,
        },
      };
    });

  // 只提交接口需要的三个字段
  const toMentionInputs = (mentions: CommentMentionType[]): CommentMentionInput[] =>
    mentions.map(({ userId, start, end }) => ({ userId, start, end }));

  return {
    // 透传给 MentionPicker（未展开或没有成员可提及时为 null）
    picker:
      mention && mentionEnabled
        ? {
            candidates: filtered,
            activeUserId: active?.userId ?? null,
            onSelect: commit,
            onHighlight: (userId: string | null) => {
              const index = filtered.findIndex((c) => c.userId === userId);
              if (index !== -1) setActiveIndex(index);
            },
          }
        : null,
    // 透传给 AutoGrowTextarea
    onSelectionChange,
    caretRequest,
    handleKeyDown,
    resolveMentions,
    toMentionInputs,
    close,
    // 提交成功后清空"选过的成员"
    resetPicked: () => {
      pickedRef.current = new Set();
    },
  };
}
