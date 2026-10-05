"use client";

import { useEffect, useRef } from "react";
import { countUnreadComments, latestCommentCreatedAt } from "@/lib/comment-text";
import { postCommentReadAPI } from "@/lib/api/CommentAPI";
import { CommentType } from "@/types/comment";
import { useUserDataStore } from "@/store/userDataStore";
import { useCommentReadStore } from "@/store/commentReadStore";
import { useDocumentVisible } from "@/hooks/useDocumentVisible";

// 面板持续可见时消息会不断到来：合并成一次上报
const REPORT_DEBOUNCE_MS = 800;

// 取两个水位线里较晚的一个（null 表示从未读过，视作最小）
function laterWatermark(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a) >= new Date(b) ? a : b;
}

// 项目级讨论的未读状态：
// - 水位线 = 已读到的最后一条评论的 createdAt，只前进
// - 面板可见且页面在前台时才推进（这时收到的消息就是"已读"，不提示）
// - 面板折叠或页面在后台时收到的消息不推进 → 折叠状态下的红点
// 打开项目时的分割线不走这里：它由服务端在 GET 项目详情时算好（firstUnreadCommentId）当快照下发
export function useCommentReadState({
  projectId,
  comments,
  initialLastReadAt,
  panelVisible,
}: {
  projectId: string;
  comments: CommentType[];
  // 服务端下发的初始水位线（null 表示从未读过）
  initialLastReadAt?: string | null;
  // 讨论面板当前是否真的可见：宽屏看右侧面板展开状态，窄屏看抽屉
  panelVisible: boolean;
}) {
  const currentUserId = useUserDataStore((state) => state.id);
  const isVisible = useDocumentVisible();

  const storedLastReadAt = useCommentReadStore(
    (state) => state.lastReadAtByProject[projectId]
  );
  const advance = useCommentReadStore((state) => state.advance);

  // 实时水位线：红点用它判断（本会话推进过的值优先于服务端下发的旧值）
  const lastReadAt = laterWatermark(initialLastReadAt, storedLastReadAt);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!panelVisible || !isVisible) return;

    const latest = latestCommentCreatedAt(comments);
    if (!latest) return;
    if (lastReadAt && new Date(latest) <= new Date(lastReadAt)) return;

    // 推进水位线（写 store：外部状态，不是组件内部 state）
    advance(projectId, latest);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      postCommentReadAPI({ projectId, lastReadAt: latest }).catch((err) => {
        // 已读水位线属于弱数据：上报失败不回滚（否则红点会闪回），仅记录日志
        console.error("[useCommentReadState] mark read failed:", err);
      });
    }, REPORT_DEBOUNCE_MS);
  }, [panelVisible, isVisible, comments, lastReadAt, projectId, advance]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    // 折叠状态下是否还有没读过的评论（红点）
    hasUnread: countUnreadComments(comments, lastReadAt, currentUserId) > 0,
    lastReadAt,
  };
}
