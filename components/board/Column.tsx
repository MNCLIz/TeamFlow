"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BoardColumn as BoardColumnType } from "@/types/board";
import { CardItem } from "./Card";

interface ColumnProps {
  column: BoardColumnType;
  projectId: string;
}

export function Column({ column, projectId }: ColumnProps) {
  return (
    <div className="w-72 flex-shrink-0 bg-gray-50 rounded-lg p-3">
      <h3 className="font-semibold mb-3 px-1">{column.name}</h3>
      <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[100px]">
          {column.cards.map((card) => (
            <CardItem key={card.id} card={card} projectId={projectId} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
