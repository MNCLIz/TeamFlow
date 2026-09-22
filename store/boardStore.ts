import { create } from "zustand";
import type { ColumnType, CardType, TaskState } from "@/types/board";
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
  fetchColumns: (projectId: string) => Promise<void>;
  createCard: (params: {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    state: TaskState;
    assigneeId?: string;
  }) => Promise<CardType>;
  updateCard: (params: {
    id: string;
    title?: string;
    description?: string;
    priority?: string;
    assigneeId?: string;
    state?: TaskState;
  }) => Promise<CardType>;
  removeCard: (cardId: string) => Promise<void>;
  moveCard: (params: {
    id: string;
    toState: TaskState;
    order: number;
  }) => Promise<void>;
  updateCardDescription: (params: { id: string, name?: string, description?: string }) => Promise<void>;
}

export const useBoardStore = create<BoardState>()(immer((set) => ({
  columns: [],
  isLoading: false,
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
    set((state) => {
      const targetColumn = state.columns.find((col) => col.state === params.state);
      if (targetColumn) {
        targetColumn.cards.push(card);
        targetColumn.cards.sort((a, b) => a.order - b.order);
      }
    });
    return card;
  },
  updateCard: async (params) => {
    const card = await patchCardAPI(params);
    set((state) => {
      let sourceColumn: ColumnType | undefined;
      let idx = -1;
      for (const column of state.columns) {
        idx = column.cards.findIndex((c) => c.id === params.id);
        if (idx !== -1) {
          sourceColumn = column;
          break;
        }
      }
      if (!sourceColumn || idx === -1) return;
      if (sourceColumn.state !== card.state) {
        sourceColumn.cards.splice(idx, 1);
        const targetColumn = state.columns.find((col) => col.state === card.state);
        if (targetColumn) {
          targetColumn.cards.push(card);
          targetColumn.cards.sort((a, b) => a.order - b.order);
        }
      } else {
        sourceColumn.cards[idx] = card;
      }
    });
    return card;
  },
  removeCard: async (cardId: string) => {
    await deleteCardAPI({ id: cardId });
    set((state) => {
      for (const column of state.columns) {
        column.cards = column.cards.filter((card) => card.id !== cardId);
      }
    });
  },
  moveCard: async (params) => {
    const result = await postMoveCardAPI({
      id: params.id,
      state: params.toState,
      order: params.order,
    });
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
        movedCard.state = result.state;
        const targetColumn = state.columns.find((col) => col.state === result.state);
        if (targetColumn) {
          targetColumn.cards.push(movedCard);
          targetColumn.cards.sort((a, b) => a.order - b.order);
        }
      }
    });
  },
  // 更新卡片标题与描述
  updateCardDescription: async (params: { id: string, name?: string, description?: string }) => {
    await patchCardAPI({ id: params.id, title: params.name, description: params.description });
    set((state) => {
      for (const column of state.columns) {
        const idx = column.cards.findIndex((c) => c.id === params.id);
        if (idx !== -1) {
          if(params.name) column.cards[idx].title = params.name;
          if(params.description) column.cards[idx].description = params.description;
          break;
        }
      }
    });
  }
})));
