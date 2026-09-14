"use client";

import type { BoardCard } from "@/types/board";

interface CardDetailModalProps {
  card: BoardCard | null;
  onClose: () => void;
}

export function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  if (!card) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">{card.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {card.description && <p className="text-gray-600 mb-4 whitespace-pre-wrap">{card.description}</p>}
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Priority: {card.priority}</span>
          {card.dueDate && <span>Due: {new Date(card.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  );
}
