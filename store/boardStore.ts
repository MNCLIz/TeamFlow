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
  // 当前 columns 属于哪个项目；null 表示还没拉过看板数据
  // 看板页据此判断「本项目看板是否已加载结束（成功或失败）」：未结束显示骨架屏
  loadedProjectId: string | null;
  // 全量任务列表，供 /tasks 页使用；与 columns 共享同一数据源，写入操作会同步更新两者
  cards: CardType[];
  isLoading: boolean;
  // /tasks 页首次拉取是否已结束（成功或失败）；只由 fetchCards 写入，不受 fetchColumns 影响
  hasLoadedCards: boolean;
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
  loadedProjectId: null,
  cards: [],
  isLoading: false,
  hasLoadedCards: false,
  fetchColumns: async (projectId: string) => {
    set((state) => { state.isLoading = true; });
    try {
      const columns = await getColumnAPI({ id: projectId });
      set((state) => {
        state.columns = columns;
        state.loadedProjectId = projectId;
        state.isLoading = false;
      });
    } catch {
      // 成功、失败都要置位：否则接口报错时骨架屏会一直不消失；
      // 同时清空 columns，避免上一个项目的看板数据被显示在本项目页
      set((state) => {
        state.columns = [];
        state.loadedProjectId = projectId;
        state.isLoading = false;
      });
    }
  },
  fetchCards: async () => {
    set((state) => { state.isLoading = true; });
    try {
      const cards = await getCardsAPI();
      set((state) => {
        state.cards = cards;
      });
    } catch {
      // 失败不额外提示，保持原有静默行为，仅结束加载态
    } finally {
      // 成功、失败都要置位：否则接口报错时骨架屏会一直不消失
      set((state) => {
        state.isLoading = false;
        state.hasLoadedCards = true;
      });
    }
  },
  createCard: async (params) => {
    try {
      const card = await postCreateCardAPI(params);
      set((state) => {
        const targetColumn = state.columns.find((col) => col.state === params.state);
        // SSE 广播可能先于本次响应到达并已插入同一张卡片，此处按 id 去重
        if (targetColumn && !targetColumn.cards.some((c) => c.id === card.id)) {
          targetColumn.cards.push(card);
          targetColumn.cards.sort((a, b) => a.order - b.order);
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
    set((state) => {
      switch (eventType) {
        case "card:created": {
          const card = data as CardType;
          // 避免重复插入（本地 createCard 已 await API 响应后插入）
          const exists = state.columns.some((col) =>
            col.cards.some((c) => c.id === card.id),
          );
          if (!exists) {
            const targetColumn = state.columns.find(
              (col) => col.state === card.state,
            );
            if (targetColumn) {
              targetColumn.cards.push(card);
              targetColumn.cards.sort((a, b) => a.order - b.order);
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
