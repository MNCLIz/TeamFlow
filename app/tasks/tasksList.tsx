"use client";

import Link from "next/link";
import { CardType, Priority } from "@/types/board";

const priorityColors: Record<Priority, string> = {
  [Priority.High]: "text-red-600 bg-red-50",
  [Priority.Medium]: "text-yellow-600 bg-yellow-50",
  [Priority.Low]: "text-green-600 bg-green-50",
};

interface TasksListProps {
  cards: CardType[];
}

export function TasksList({ cards }: TasksListProps) {
  if (cards.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        No tasks yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y border rounded-lg">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-medium truncate">{card.title}</h3>
            {card.description && (
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {card.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            {card.labels.length > 0 && (
              <div className="flex gap-1">
                {card.labels.map((label) => (
                  <span
                    key={label.id}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: label.color }}
                    title={label.name}
                  />
                ))}
              </div>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[card.priority]}`}
            >
              {card.priority}
            </span>
            {card.dueDate && (
              <span className="text-xs text-gray-400">
                {new Date(card.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
