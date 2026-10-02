import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { CommentScope, CommentType, commentScopeKey } from "@/types/comment";
import {
  deleteCommentAPI,
  getCommentsAPI,
  patchCommentAPI,
  postCommentAPI,
} from "@/lib/api/CommentAPI";
import { useUserDataStore } from "@/store/userDataStore";

// 乐观插入的临时评论 id 前缀，UI 可据此显示"发送中"
export const TEMP_COMMENT_PREFIX = "temp-";

interface CommentState {
  // key 为 commentScopeKey(scope)：card:<cardId> 或 project:<projectId>
  commentsByScope: Record<string, CommentType[]>;
  loadingScopes: Record<string, boolean>;
  fetchComments: (scope: CommentScope) => Promise<void>;
  createComment: (scope: CommentScope, content: string) => Promise<void>;
  updateComment: (
    scope: CommentScope,
    params: { id: string; content?: string; resolved?: boolean }
  ) => Promise<void>;
  removeComment: (scope: CommentScope, commentId: string) => Promise<void>;
  // 处理 SSE 远程事件，将其他用户的操作同步到本地 store
  applyRemoteEvent: (eventType: string, data: unknown) => void;
}

function scopeParams(scope: CommentScope): { cardId?: string; projectId?: string } {
  return scope.type === "card"
    ? { cardId: scope.cardId }
    : { projectId: scope.projectId };
}

// 由评论数据反推作用域，用于把 SSE 事件路由到正确的列表
function scopeKeyOfComment(comment: CommentType): string {
  return comment.cardId
    ? `card:${comment.cardId}`
    : `project:${comment.projectId}`;
}

function sortByCreatedAt(comments: CommentType[]) {
  comments.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export const useCommentStore = create<CommentState>()(
  immer((set) => ({
    commentsByScope: {},
    loadingScopes: {},

    fetchComments: async (scope) => {
      const key = commentScopeKey(scope);
      set((state) => {
        state.loadingScopes[key] = true;
      });
      try {
        const comments = await getCommentsAPI(scopeParams(scope));
        set((state) => {
          sortByCreatedAt(comments);
          state.commentsByScope[key] = comments;
          state.loadingScopes[key] = false;
        });
      } catch (err) {
        console.error("[CommentStore] fetchComments failed:", err);
        set((state) => {
          state.loadingScopes[key] = false;
        });
        throw err;
      }
    },

    createComment: async (scope, content) => {
      const key = commentScopeKey(scope);
      const tempId = `${TEMP_COMMENT_PREFIX}${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const user = useUserDataStore.getState();
      const now = new Date();

      // 乐观插入：先用当前用户信息占位，成功后用服务端返回替换
      const optimistic: CommentType = {
        id: tempId,
        content,
        projectId: scope.projectId,
        cardId: scope.type === "card" ? scope.cardId : null,
        authorId: user.id,
        author: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
        resolved: false,
        resolvedAt: null,
        resolvedById: null,
        editedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        if (!state.commentsByScope[key]) state.commentsByScope[key] = [];
        state.commentsByScope[key].push(optimistic);
      });

      try {
        const created = await postCommentAPI({
          ...scopeParams(scope),
          content,
        });
        set((state) => {
          const list = state.commentsByScope[key];
          if (!list) return;
          const tempIdx = list.findIndex((c) => c.id === tempId);
          if (tempIdx === -1) return;
          // SSE 可能先于响应到达并已插入真实评论，此时直接丢弃占位项
          if (list.some((c) => c.id === created.id)) {
            list.splice(tempIdx, 1);
            return;
          }
          list[tempIdx] = created;
          sortByCreatedAt(list);
        });
      } catch (err) {
        // 失败回滚：移除占位评论
        set((state) => {
          const list = state.commentsByScope[key];
          if (list) {
            state.commentsByScope[key] = list.filter((c) => c.id !== tempId);
          }
        });
        throw err;
      }
    },

    updateComment: async (scope, params) => {
      const key = commentScopeKey(scope);
      const list = useCommentStore.getState().commentsByScope[key];
      const index = list?.findIndex((c) => c.id === params.id) ?? -1;
      if (!list || index === -1) return;
      const snapshot: CommentType = { ...list[index] };

      // 乐观更新本地状态
      set((state) => {
        const target = state.commentsByScope[key]?.[index];
        if (!target) return;
        if (params.content !== undefined && params.content !== target.content) {
          target.content = params.content;
          target.editedAt = new Date();
        }
        if (params.resolved !== undefined && params.resolved !== target.resolved) {
          target.resolved = params.resolved;
          target.resolvedAt = params.resolved ? new Date() : null;
          target.resolvedById = params.resolved
            ? useUserDataStore.getState().id
            : null;
        }
      });

      try {
        const updated = await patchCommentAPI(params);
        set((state) => {
          const list = state.commentsByScope[key];
          if (!list) return;
          const idx = list.findIndex((c) => c.id === updated.id);
          if (idx !== -1) list[idx] = updated;
        });
      } catch (err) {
        // 失败回滚到修改前的快照
        set((state) => {
          const list = state.commentsByScope[key];
          if (!list) return;
          const idx = list.findIndex((c) => c.id === params.id);
          if (idx !== -1) list[idx] = snapshot;
        });
        throw err;
      }
    },

    removeComment: async (scope, commentId) => {
      const key = commentScopeKey(scope);
      const list = useCommentStore.getState().commentsByScope[key];
      if (!list?.some((c) => c.id === commentId)) return;
      const snapshot = list.map((c) => ({ ...c }));

      set((state) => {
        state.commentsByScope[key] = (state.commentsByScope[key] ?? []).filter(
          (c) => c.id !== commentId
        );
      });

      try {
        await deleteCommentAPI(commentId);
      } catch (err) {
        // 失败回滚整份列表
        set((state) => {
          state.commentsByScope[key] = snapshot;
        });
        throw err;
      }
    },

    applyRemoteEvent: (eventType, data) => {
      set((state) => {
        switch (eventType) {
          case "comment:created": {
            const comment = data as CommentType;
            const key = scopeKeyOfComment(comment);
            const list = state.commentsByScope[key];
            // 该作用域尚未加载则忽略，等组件挂载时自行拉取
            if (!list) break;
            if (list.some((c) => c.id === comment.id)) break;
            list.push(comment);
            sortByCreatedAt(list);
            break;
          }
          case "comment:updated": {
            const comment = data as CommentType;
            const key = scopeKeyOfComment(comment);
            const list = state.commentsByScope[key];
            if (!list) break;
            const idx = list.findIndex((c) => c.id === comment.id);
            if (idx !== -1) list[idx] = comment;
            break;
          }
          case "comment:deleted": {
            const payload = data as {
              commentId: string;
              cardId: string | null;
              projectId: string;
            };
            const key = payload.cardId
              ? `card:${payload.cardId}`
              : `project:${payload.projectId}`;
            const list = state.commentsByScope[key];
            if (!list) break;
            state.commentsByScope[key] = list.filter(
              (c) => c.id !== payload.commentId
            );
            break;
          }
        }
      });
    },
  }))
);
