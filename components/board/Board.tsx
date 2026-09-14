"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useState } from "react";
import type { BoardColumn as BoardColumnType } from "@/types/board";
import { Column } from "./Column";

interface BoardProps {
  columns: BoardColumnType[];
  projectId: string;
}

export function Board({ columns, projectId }: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={({ active }) => setActiveId(active.id as string)} onDragEnd={() => setActiveId(null)}>
      <div className="flex gap-4 overflow-x-auto p-4 min-h-[calc(100vh-8rem)]">
        {columns.map((column) => (
          <Column key={column.id} column={column} projectId={projectId} />
        ))}
      </div>
      <DragOverlay>{activeId ? <div className="opacity-50 p-3 bg-white rounded shadow-lg border">Dragging...</div> : null}</DragOverlay>
    </DndContext>
  );
}
