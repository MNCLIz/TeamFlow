import { create } from "zustand";
import type { BoardColumn, BoardCard } from "@/types/board";

interface BoardState {
  columns: BoardColumn[];
  isLoading: boolean;
  setColumns: (columns: BoardColumn[]) => void;
  moveCard: (cardId: string, fromColumnId: string, toColumnId: string, newOrder: number) => void;
  addCard: (columnId: string, card: BoardCard) => void;
  removeCard: (cardId: string, columnId: string) => void;
  updateCard: (cardId: string, updates: Partial<BoardCard>) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  columns: [],
  isLoading: false,
  setColumns: (columns) => set({ columns }),
  moveCard: (cardId, fromColumnId, toColumnId, newOrder) =>
    set((state) => {
      const columns = state.columns.map((col) => {
        if (col.id === fromColumnId && col.id !== toColumnId) {
          return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        }
        if (col.id === toColumnId) {
          const existingCards = col.cards.filter((c) => c.id !== cardId);
          const movedCard =
            state.columns.flatMap((c) => c.cards).find((c) => c.id === cardId) ?? null;
          if (!movedCard) return col;
          const updatedCard = { ...movedCard, columnId: toColumnId, order: newOrder };
          const newCards = [...existingCards, updatedCard].sort((a, b) => a.order - b.order);
          return { ...col, cards: newCards };
        }
        return col;
      });
      return { columns };
    }),
  addCard: (columnId, card) =>
    set((state) => ({
      columns: state.columns.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      ),
    })),
  removeCard: (cardId, columnId) =>
    set((state) => ({
      columns: state.columns.map((col) =>
        col.id === columnId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col
      ),
    })),
  updateCard: (cardId, updates) =>
    set((state) => ({
      columns: state.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
      })),
    })),
}));
