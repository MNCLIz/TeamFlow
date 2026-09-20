"use client";

import { DndContext, DragOverlay, closestCorners } from "@dnd-kit/core";
import { useEffect, useState } from "react";
import { Column } from "./Column";
import { useBoardStore } from "@/store/boardStore";

export function Board() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = useBoardStore((state) => state.columns);

  useEffect(() => {
    console.log("columns改变", columns);
  }, [columns]);

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto p-4 items-start">
        {columns.map((column) => (
          <Column
            key={column.id}
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
