"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ColumnType } from "@/types/board";
import { CardItem } from "./Card";
import { useBoardStore } from "@/store/boardStore";

interface ColumnProps {
  column: ColumnType;
  projectId: string;
}

export function Column({ column, projectId }: ColumnProps) {
  const createCard = useBoardStore((state) => state.createCard);

  const handleCreateCard = async () => {
    await createCard({
      projectId,
      title: "New Task",
      columnId: column.id,
    });
  };

  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 rounded-lg p-3 flex flex-col">
      <h3 className="font-semibold mb-3 px-1 flex-shrink-0">{column.name}</h3>
      <SortableContext
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-col gap-2 min-h-[40px] flex-1 overflow-y-auto">
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
