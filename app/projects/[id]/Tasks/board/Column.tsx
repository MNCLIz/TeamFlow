"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ColumnType } from "@/types/board";
import { TaskState } from "@/types/board";
import { CardItem } from "./Card";
import { useBoardStore } from "@/store/boardStore";

interface ColumnProps {
  column: ColumnType;
  projectId: string;
}

const ColumnsColor: Record<TaskState, [string, string]> = {
  [TaskState.Todo]: ["bg-gray-100", "bg-gray-200"],
  [TaskState.UpNext]: ["bg-orange-100", "bg-orange-200"],
  [TaskState.InProgress]: ["bg-cyan-100", "bg-cyan-200"],
  [TaskState.Done]: ["bg-emerald-100", "bg-emerald-200"],
};

export function Column({ column, projectId }: ColumnProps) {
  const createCard = useBoardStore((state) => state.createCard);

  // 注册列为拖放放置目标，使跨栏拖放可被碰撞检测识别
  const { setNodeRef } = useDroppable({ id: column.state });

  const handleCreateCard = async () => {
    await createCard({
      projectId,
      title: "New Task",
      state: column.state,
    });
  };

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 rounded-lg p-3 flex flex-col ${ColumnsColor[column.state][0]}`}
    >
      <h3 className="font-medium mb-3 px-1 flex-shrink-0">
        <span
          className={`rounded-lg px-2 py-1 text-sm ${ColumnsColor[column.state][1]}`}
        >
          {column.name}
        </span>
      </h3>
      <SortableContext
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-col gap-2  flex-1 overflow-y-auto">
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} projectId={projectId} />
          ))}
        </div>
      </SortableContext>

      <button
        onClick={handleCreateCard}
        className="mt-2 w-full text-left bg-white p-3 rounded shadow-sm border cursor-pointer hover:shadow-md transition-shadow flex-shrink-0"
      >
        <h4 className="font-medium text-sm">+ 新建任务</h4>
      </button>
    </div>
  );
}
