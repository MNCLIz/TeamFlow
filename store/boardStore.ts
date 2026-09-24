import { create } from "zustand";
import type { ColumnType, CardType, TaskState } from "@/types/board";
import { immer } from "zustand/middleware/immer";
import {
  getColumnAPI,
  getCardsAPI,
  postCreateCardAPI,
  patchCardAPI,
  deleteCardAPI,
  postMoveCardAPI,
} from "@/lib/api/BoardAPI";

interface BoardState {
  columns: ColumnType[];
  // 全量任务列表，供 /tasks 页使用；与 columns 共享同一数据源，写入操作会同步更新两者
  cards: CardType[];
  isLoading: boolean;
  fetchColumns: (projectId: string) => Promise<void>;
  fetchCards: () => Promise<void>;
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
  // 纯本地重排序（不调 API），用于 onDragOver 实时视觉反馈
  reorderCard: (params: {
    id: string;
    toState: TaskState;
    newIndex: number;
  }) => void;
  updateCardDescription: (params: { id: string, name?: string, description?: string }) => Promise<void>;
  // 处理 SSE 远程事件，将其他用户的操作同步到本地 store
  applyRemoteEvent: (eventType: string, data: unknown) => void;
}

export const useBoardStore = create<BoardState>()(immer((set) => ({
  columns: [],
  cards: [],
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
  fetchCards: async () => {
    set((state) => { state.isLoading = true; });
    try {
      const cards = await getCardsAPI();
      set((state) => {
        state.cards = cards;
        state.isLoading = false;
      });
    } catch {
      set((state) => { state.isLoading = false; });
    }
  },
  createCard: async (params) => {
    console.log("[Store] createCard called with params:", params);
    try {
      const card = await postCreateCardAPI(params);
      console.log("[Store] createCard API response:", card);
      set((state) => {
        const targetColumn = state.columns.find((col) => col.state === params.state);
        console.log("[Store] createCard targetColumn found:", !!targetColumn, "params.state:", params.state);
        if (targetColumn) {
          targetColumn.cards.push(card);
          targetColumn.cards.sort((a, b) => a.order - b.order);
          console.log("[Store] createCard inserted, column cards count:", targetColumn.cards.length);
        }
      });
      return card;
    } catch (err) {
      console.error("[Store] createCard failed:", err);
      throw err;
    }
  },
  updateCard: async (params) => {
    const card = await patchCardAPI(params);
    set((state) => {
      // 同步扁平 cards 列表（/tasks 页数据源），独立于 columns
      const flatIdx = state.cards.findIndex((c) => c.id === card.id);
      if (flatIdx !== -1) state.cards[flatIdx] = card;

      // 同步 columns（看板页数据源）
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
      state.cards = state.cards.filter((card) => card.id !== cardId);
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
  // 拖拽悬停时的本地即时重排序，不调用 API
  reorderCard: (params) => {
    set((state) => {
      let movedCard: CardType | undefined;
      // 从源列中移除卡片
      for (const column of state.columns) {
        const idx = column.cards.findIndex((c) => c.id === params.id);
        if (idx !== -1) {
          movedCard = column.cards.splice(idx, 1)[0];
          break;
        }
      }
      if (!movedCard) return;
      movedCard.state = params.toState;
      const targetColumn = state.columns.find((col) => col.state === params.toState);
      if (!targetColumn) return;
      // 插入到新位置并重新计算 order
      targetColumn.cards.splice(params.newIndex, 0, movedCard);
      targetColumn.cards.forEach((card, i) => { card.order = i; });
    });
  },
  // 更新卡片标题与描述
  updateCardDescription: async (params: { id: string, name?: string, description?: string }) => {
    await patchCardAPI({ id: params.id, title: params.name, description: params.description });
    set((state) => {
      // 同步扁平 cards 列表
      const flatCard = state.cards.find((c) => c.id === params.id);
      if (flatCard) {
        if (params.name) flatCard.title = params.name;
        if (params.description) flatCard.description = params.description;
      }
      // 同步 columns
      for (const column of state.columns) {
        const idx = column.cards.findIndex((c) => c.id === params.id);
        if (idx !== -1) {
          if(params.name) column.cards[idx].title = params.name;
          if(params.description) column.cards[idx].description = params.description;
          break;
        }
      }
    });
  },
  // 处理 SSE 远程事件，将其他用户的操作同步到本地 store
  applyRemoteEvent: (eventType: string, data: unknown) => {
    console.log("[Store] applyRemoteEvent called:", eventType, data);
    set((state) => {
      console.log("[Store] inside set(), columns count:", state.columns.length);
      switch (eventType) {
        case "card:created": {
          const card = data as CardType;
          console.log("[Store] card:created event received:", card.id, card.title, "state:", card.state);
          // 避免重复插入（本地 createCard 已 await API 响应后插入）
          const exists = state.columns.some((col) =>
            col.cards.some((c) => c.id === card.id),
          );
          console.log("[Store] card:created dedup check - exists:", exists);
          if (!exists) {
            const targetColumn = state.columns.find(
              (col) => col.state === card.state,
            );
            console.log("[Store] card:created target column found:", !!targetColumn, "columns:", state.columns.map(c => c.state));
            if (targetColumn) {
              targetColumn.cards.push(card);
              targetColumn.cards.sort((a, b) => a.order - b.order);
              console.log("[Store] card:created inserted successfully");
            }
          }
          break;
        }
        case "card:updated": {
          const card = data as CardType;
          for (const column of state.columns) {
            const idx = column.cards.findIndex((c) => c.id === card.id);
            if (idx !== -1) {
              // state 变更时先移除再插入目标列
              if (column.state !== card.state) {
                column.cards.splice(idx, 1);
                const targetColumn = state.columns.find(
                  (col) => col.state === card.state,
                );
                if (targetColumn) {
                  targetColumn.cards.push(card);
                  targetColumn.cards.sort((a, b) => a.order - b.order);
                }
              } else {
                column.cards[idx] = card;
              }
              break;
            }
          }
          break;
        }
        case "card:moved": {
          const { cardId, toState } = data as {
            cardId: string;
            fromState: string;
            toState: TaskState;
          };
          let movedCard: CardType | undefined;
          for (const column of state.columns) {
            const idx = column.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              movedCard = column.cards.splice(idx, 1)[0];
              break;
            }
          }
          if (movedCard) {
            movedCard.state = toState;
            const targetColumn = state.columns.find(
              (col) => col.state === toState,
            );
            if (targetColumn) {
              targetColumn.cards.push(movedCard);
              targetColumn.cards.sort((a, b) => a.order - b.order);
            }
          }
          break;
        }
        case "card:deleted": {
          const { cardId } = data as { cardId: string };
          for (const column of state.columns) {
            column.cards = column.cards.filter((c) => c.id !== cardId);
          }
          break;
        }
      }
    });
  },
})));
