import { request } from "@/lib/request";
import { CardType, ColumnType, TaskState } from "@/types/board";

// 创建任务卡片（项目内）
interface PostCreateCardAPIParams {
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  state: TaskState;
  assigneeId?: string;
}
export const postCreateCardAPI = async (params: PostCreateCardAPIParams) => {
  return await request<PostCreateCardAPIParams, CardType>({
    url: `/projects/${params.projectId}/cards`,
    method: "POST",
    data: params,
  });
};

// 创建独立任务卡片（不绑定项目）
interface PostCreateStandaloneCardParams {
  title: string;
  description?: string;
  priority?: string;
  state?: TaskState;
  // 可选：直接指派给某人（首页快捷新建会指派给自己，保证任务立刻出现在「我的任务」里）
  assigneeId?: string;
}
export const postCreateStandaloneCardAPI = async (
  params: PostCreateStandaloneCardParams,
) => {
  return await request<PostCreateStandaloneCardParams, CardType>({
    url: `/cards`,
    method: "POST",
    data: params,
  });
};

// 修改任务卡片
interface PatchCardAPIParams {
  id: string;
  title?: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  state?: TaskState;
}
export const patchCardAPI = async (params: PatchCardAPIParams) => {
  return await request<PatchCardAPIParams, CardType>({
    url: `/cards/${params.id}`,
    method: "PATCH",
    data: params,
  });
};

// 删除任务卡片
interface DeleteCardAPIParams {
  id: string;
}
interface DeleteCardAPIResponse {
  deleted: boolean;
}
export const deleteCardAPI = async (params: DeleteCardAPIParams) => {
  return await request<DeleteCardAPIParams, DeleteCardAPIResponse>({
    url: `/cards/${params.id}`,
    method: "DELETE",
  });
};

// 移动任务卡片
interface PostMoveCardAPIParams {
  id: string;
  state: TaskState;
  order: number;
}
export const postMoveCardAPI = async (params: PostMoveCardAPIParams) => {
  return await request<PostMoveCardAPIParams, CardType>({
    url: `/cards/${params.id}/move`,
    method: "POST",
    data: params,
  });
};

// 获取所有任务列表（按 updatedAt 降序）
export const getCardsAPI = async () => {
  return await request<never, CardType[]>({
    url: `/cards`,
  });
};

// 获取任务列数据
export const getColumnAPI = async (params: { id: string }) => {
  return await request<{ id: string }, ColumnType[]>({
    url: `/projects/${params.id}/columns`,
  });
};
