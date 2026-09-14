"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BoardCard } from "@/types/board";

interface CardItemProps {
  card: BoardCard;
  projectId: string;
}

export function CardItem({ card }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <h4 className="font-medium text-sm">{card.title}</h4>
      {card.priority !== "MEDIUM" && (
        <span
          className={`text-xs mt-1 inline-block px-1.5 py-0.5 rounded ${
            card.priority === "HIGH" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {card.priority}
        </span>
      )}
    </div>
  );
}
