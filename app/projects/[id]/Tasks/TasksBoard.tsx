"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { Column } from "@/app/projects/[id]/Tasks/board/Column";
import { useBoardStore } from "@/store/boardStore";

export function TasksBoard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useBoardStore((state) => state.columns);

  useEffect(() => {}, [columns]);

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={() => setActiveId(null)}
    >
      <div className="flex gap-4 p-4 items-start flex-wrap">
        {columns.map((column) => (
          <Column
            key={column.state}
            column={column}
            projectId={column.projectId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeId ? (
          <div className="opacity-50 p-3 bg-white rounded shadow-lg border">
            Dragging...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
