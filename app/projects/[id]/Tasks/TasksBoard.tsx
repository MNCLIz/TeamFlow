"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { Column } from "@/app/projects/[id]/Tasks/board/Column";
import { TasksBoardSkeleton } from "@/app/projects/[id]/Tasks/TasksBoardSkeleton";
import { useBoardStore } from "@/store/boardStore";
import type { TaskState } from "@/types/board";
import { Priority } from "@/types/board";

const priorityDotColor: Record<Priority, string> = {
  [Priority.High]: "bg-red-500",
  [Priority.Medium]: "bg-yellow-500",
  [Priority.Low]: "bg-green-500",
};

export function TasksBoard({ projectId }: { projectId: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const { columns, loadedProjectId, fetchColumns, reorderCard, moveCard } =
    useBoardStore();

  // 记录本次挂载已发起请求的项目：开发模式 StrictMode 会重复执行 effect，
  // 去掉这层防重会连发两次相同请求
  const requestedProjectId = useRef<string | null>(null);

  // 拉取本项目看板数据：store 里已有本项目数据时（切换页签来回切）不重复请求
  useEffect(() => {
    if (loadedProjectId === projectId) return;
    if (requestedProjectId.current === projectId) return;
    requestedProjectId.current = projectId;
    fetchColumns(projectId);
  }, [projectId, loadedProjectId, fetchColumns]);

  // 首次加载（含首帧）或切换项目后：显示骨架屏，避免空白/「暂无任务」闪现
  if (loadedProjectId !== projectId) {
    return <TasksBoardSkeleton />;
  }

  // SSE 订阅统一由 ProjectClient 处理（卡片与评论事件共用一条连接）

  // 根据碰撞检测的 over.id 判断目标列或目标卡片所属列
  const findColumnByOverId = (overId: string | number): TaskState | null => {
    for (const col of columns) {
      if (col.state === overId) return col.state;
      if (col.cards.some((c) => c.id === overId)) return col.state;
    }
    return null;
  };

  // 拖拽悬停时即时重排序，提供视觉反馈（不调 API）
  const handleDragOver = ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    const targetState = findColumnByOverId(overIdStr);
    if (!targetState) return;

    const targetCol = columns.find((c) => c.state === targetState);
    if (!targetCol) return;

    const overCardIndex = targetCol.cards.findIndex((c) => c.id === overIdStr);
    const newIndex =
      overCardIndex >= 0 ? overCardIndex : targetCol.cards.length;

    reorderCard({ id: activeIdStr, toState: targetState, newIndex });
  };

  // 拖放结束时持久化位置：调用 moveCard API
  const handleDragEnd = ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) => {
    setActiveId(null);
    if (!over) return;

    const cardId = String(active.id);
    const targetState = findColumnByOverId(String(over.id));
    if (!targetState) return;

    // 从当前 store 状态中找到卡片的最终位置和 order
    const targetCol = columns.find((c) => c.state === targetState);
    if (!targetCol) return;

    const cardIndex = targetCol.cards.findIndex((c) => c.id === cardId);
    const order =
      cardIndex >= 0
        ? targetCol.cards[cardIndex].order
        : targetCol.cards.length;

    moveCard({ id: cardId, toState: targetState, order });
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        data-slot="tasks-board"
        className="flex gap-4 p-4 items-start flex-wrap"
      >
        {columns.map((column) => (
          <Column
            key={column.state}
            column={column}
            projectId={column.projectId}
          />
        ))}
      </div>
      {/* 拖拽时显示真实卡片样式的浮层 */}
      <DragOverlay>
        {activeId
          ? (() => {
              const card = columns
                .flatMap((c) => c.cards)
                .find((c) => c.id === activeId);
              if (!card) return null;
              return (
                <div className="opacity-80 p-3 bg-white rounded shadow-lg border w-72">
                  <h4 className="font-medium text-sm flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${priorityDotColor[card.priority]}`}
                    />
                    {card.title}
                  </h4>
                </div>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}
