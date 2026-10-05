"use client";

import { useEffect, useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TasksList } from "./tasksList";
import { postCreateStandaloneCardAPI } from "@/lib/api/BoardAPI";
import { useBoardStore } from "@/store/boardStore";
import { ListSkeleton } from "@/components/shared/ListSkeleton/ListSkeleton";

export function TasksClient() {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">全部任务</h1>
        <NewTaskButton />
      </div>
      <TasksListWrapper />
    </>
  );
}

function NewTaskButton() {
  const [creating, setCreating] = useState(false);
  const fetchCards = useBoardStore((state) => state.fetchCards);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      await postCreateStandaloneCardAPI({
        title: "新任务",
      });
      // 创建后重新拉取 store 数据，避免整页刷新
      await fetchCards();
    } catch {
      toast.error("创建任务失败");
    } finally {
      setCreating(false);
    }
  }, [fetchCards]);

  return (
    <Button
      onClick={handleCreate}
      disabled={creating}
      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      {creating ? "创建中..." : "新建任务"}
    </Button>
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
