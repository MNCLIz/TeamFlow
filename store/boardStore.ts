import { create } from "zustand";
import type { ColumnType, CardType } from "@/types/board";
import { immer } from "zustand/middleware/immer";
import {
  getColumnAPI,
  postCreateCardAPI,
  patchCardAPI,
  deleteCardAPI,
  postMoveCardAPI,
} from "@/lib/api/BoardAPI";

interface BoardState {
  columns: ColumnType[];
  isLoading: boolean;
  setColumns: (columns: ColumnType[]) => void;
  addCard: (card: CardType) => void;
  setCard: (card: CardType) => void;
  deleteCard: (cardId: string) => void;
  fetchColumns: (projectId: string) => Promise<void>;
  createCard: (params: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    columnId: string;
    assigneeId?: string;
    labelIds?: string[];
  }) => Promise<CardType>;
  updateCard: (params: {
    id: string;
    title?: string;
    description?: string;
    priority?: string;
    assigneeId?: string;
    labelIds?: string[];
  }) => Promise<CardType>;
  removeCard: (cardId: string) => Promise<void>;
  moveCard: (params: {
    id: string;
    toColumnId: string;
    order: number;
  }) => Promise<void>;
}

export const useBoardStore = create<BoardState>()(immer((set, get) => ({
  columns: [],
  isLoading: false,
  setColumns: (columns) => set((state) => {
    state.columns = columns;
  }),
  addCard: (card: CardType) => {
    set((state) => {
      const column = state.columns.find((col) => col.id === card.columnId);
      if (column) {
        column.cards.push(card);
      }
    });
  },
  setCard: (card: CardType) => {
    set((state) => {
      for (const column of state.columns) {
        const idx = column.cards.findIndex((c) => c.id === card.id);
        if (idx !== -1) {
          column.cards[idx] = card;
          return;
        }
      }
    });
  },
  deleteCard: (cardId: string) => {
    set((state) => {
      for (const column of state.columns) {
        column.cards = column.cards.filter((card) => card.id !== cardId);
      }
    });
  },
  fetchColumns: async (projectId: string) => {
    set((state) => { state.isLoading = true; });
    try {
      const columns = await getColumnAPI({ id: projectId });
      set((state) => {
        state.columns = columns;
        state.isLoading = false;
      });
    } catch {
      set((state) => { state.isLoading = false; });
    }
  },
  createCard: async (params) => {
    const card = await postCreateCardAPI(params);
    get().addCard(card);
    return card;
  },
  updateCard: async (params) => {
    const card = await patchCardAPI(params);
    get().setCard(card);
    return card;
  },
  removeCard: async (cardId: string) => {
    await deleteCardAPI({ id: cardId });
    get().deleteCard(cardId);
  },
  moveCard: async (params) => {
    const result = await postMoveCardAPI(params);
    set((state) => {
      let movedCard: CardType | undefined;
      for (const column of state.columns) {
        const idx = column.cards.findIndex((c) => c.id === params.id);
        if (idx !== -1) {
          movedCard = column.cards.splice(idx, 1)[0];
          break;
        }
      }
      if (movedCard) {
        movedCard.order = result.order;
        movedCard.columnId = result.toColumnId;
        const targetColumn = state.columns.find((col) => col.id === result.toColumnId);
        if (targetColumn) {
          targetColumn.cards.push(movedCard);
          targetColumn.cards.sort((a, b) => a.order - b.order);
        }
      }
    });
  },
})));
