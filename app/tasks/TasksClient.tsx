"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { TasksList } from "./tasksList";
import { useBoardStore } from "@/store/boardStore";
import { ListSkeleton } from "@/components/shared/ListSkeleton/ListSkeleton";
import { NewTaskButton } from "@/components/shared/NewActionButtons/NewTaskButton";

export function TasksClient() {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">全部任务</h1>
        <NewTaskButton size="default" />
      </div>
      <TasksListWrapper />
    </>
  );
}

function TasksListWrapper() {
  // 订阅 store 的扁平 cards 列表，写入操作（改优先级/删除等）会自动触发重渲染
  const cards = useBoardStore((state) => state.cards);
  const hasLoadedCards = useBoardStore((state) => state.hasLoadedCards);
  const fetchCards = useBoardStore((state) => state.fetchCards);

  useEffect(() => {
    fetchCards().catch(() => toast.error("获取任务列表失败"));
  }, [fetchCards]);

  // 首次加载未结束前显示骨架屏（含首帧，避免空态闪现）；已加载过则保留旧数据静默刷新
  if (!hasLoadedCards) {
    return <ListSkeleton variant="task" />;
  }

  return <TasksList cards={cards} />;
}
