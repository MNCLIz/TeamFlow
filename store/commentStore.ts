import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  CommentScope,
  CommentType,
  commentScopeKey,
  type CommentMentionType,
} from "@/types/comment";
import {
  deleteCommentAPI,
  getCommentsAPI,
  patchCommentAPI,
  postCommentAPI,
} from "@/lib/api/CommentAPI";
// 纯文本工具从 comment-text 引入：comment-utils 依赖 Prisma，客户端不可引用
import { buildQuotedExcerpt } from "@/lib/comment-text";
import { useUserDataStore } from "@/store/userDataStore";

// 乐观插入的临时评论 id 前缀，UI 可据此显示"发送中"
export const TEMP_COMMENT_PREFIX = "temp-";

interface CommentState {
  // key 为 commentScopeKey(scope)：card:<cardId> 或 project:<projectId>
  commentsByScope: Record<string, CommentType[]>;
  loadingScopes: Record<string, boolean>;
  fetchComments: (scope: CommentScope) => Promise<void>;
  createComment: (
    scope: CommentScope,
    content: string,
    parentId?: string | null,
    // @提及（含位置）：由输入框在提交时按最终正文算好
    mentions?: CommentMentionType[]
  ) => Promise<void>;
  updateComment: (
    scope: CommentScope,
    params: {
      id: string;
      content?: string;
      resolved?: boolean;
      // 全量替换的 @提及（含位置）；不传表示不动提及
      mentions?: CommentMentionType[];
    }
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

// 某条评论被删除后，把引用它的回复的 parentId 置空（保留引用快照），
// 对应数据库层面的 onDelete: SetNull
function detachReplies(comments: CommentType[] | undefined, deletedId: string) {
  if (!comments) return;
  for (const comment of comments) {
    if (comment.parentId === deletedId) comment.parentId = null;
  }
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

    createComment: async (scope, content, parentId, mentions) => {
      const key = commentScopeKey(scope);
      const tempId = `${TEMP_COMMENT_PREFIX}${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const user = useUserDataStore.getState();
      const now = new Date();

      // 引用快照：与服务端同规则——取根评论（回复的回复也指向根）的作者名与内容摘要
      let quoted: Pick<
        CommentType,
        "parentId" | "quotedAuthorName" | "quotedExcerpt"
      > = { parentId: null, quotedAuthorName: null, quotedExcerpt: null };
      if (parentId) {
        const list = useCommentStore.getState().commentsByScope[key] ?? [];
        const target = list.find((c) => c.id === parentId);
        const root = target
          ? (list.find((c) => c.id === target.parentId) ?? target)
          : undefined;
        quoted = {
          parentId: root?.id ?? parentId,
          quotedAuthorName:
            root?.author?.name ?? root?.author?.email ?? null,
          quotedExcerpt: root ? buildQuotedExcerpt(root.content) : null,
        };
      }

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
        mentions: mentions ?? [],
        ...quoted,
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
          parentId: parentId ?? undefined,
          mentions: mentions?.map(({ userId, start, end }) => ({
            userId,
            start,
            end,
          })),
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
        if (params.mentions !== undefined) {
          target.mentions = params.mentions;
        }
      });

      try {
        const updated = await patchCommentAPI({
          id: params.id,
          content: params.content,
          resolved: params.resolved,
          mentions: params.mentions?.map(({ userId, start, end }) => ({
            userId,
            start,
            end,
          })),
        });
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
        // 被删除的评论若被引用，其回复的 parentId 置空（与服务端 SetNull 一致），
        // 这样引用条立即变为"原评论已删除"，无需刷新
        detachReplies(state.commentsByScope[key], commentId);
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
              projectId: string | null;
            };
            const key = payload.cardId
              ? `card:${payload.cardId}`
              : `project:${payload.projectId}`;
            const list = state.commentsByScope[key];
            if (!list) break;
            state.commentsByScope[key] = list.filter(
              (c) => c.id !== payload.commentId
            );
            detachReplies(state.commentsByScope[key], payload.commentId);
            break;
          }
        }
      });
    },
  }))
);
