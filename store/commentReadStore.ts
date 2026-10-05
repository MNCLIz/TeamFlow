import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

// 项目级讨论的已读水位线（本会话内的乐观值；持久化在 project_members.lastReadAt）
// 放 store 而不是组件 state：面板可见期间收到评论要把水位线推进，
// 这属于「与外部系统同步」而不是组件内部状态派生，放全局也更贴合项目既有做法
interface CommentReadState {
  // key 为 projectId，值为「已读到的最后一条评论的 createdAt」
  lastReadAtByProject: Record<string, string>;
  // 只前进：传入更早的时间不生效
  advance: (projectId: string, lastReadAt: string) => void;
}

export const useCommentReadStore = create<CommentReadState>()(
  immer((set) => ({
    lastReadAtByProject: {},

    advance: (projectId, lastReadAt) =>
      set((state) => {
        const current = state.lastReadAtByProject[projectId];
        if (current && new Date(current) >= new Date(lastReadAt)) return;
        state.lastReadAtByProject[projectId] = lastReadAt;
      }),
  }))
);
