import { request } from "@/lib/request";
import { CommentType } from "@/types/comment";

// 获取评论列表：带 cardId 查卡片评论，带 projectId 查项目级讨论
interface GetCommentsAPIParams {
  cardId?: string;
  projectId?: string;
}
export const getCommentsAPI = async (params: GetCommentsAPIParams) => {
  return await request<GetCommentsAPIParams, CommentType[]>({
    url: `/comments`,
    data: params,
  });
};

// 创建评论（cardId 与 projectId 二选一）
interface PostCommentAPIParams {
  cardId?: string;
  projectId?: string;
  content: string;
}
export const postCommentAPI = async (params: PostCommentAPIParams) => {
  return await request<PostCommentAPIParams, CommentType>({
    url: `/comments`,
    method: "POST",
    data: params,
  });
};

// 更新评论：content 仅作者可改，resolved 任何成员可改
interface PatchCommentAPIParams {
  id: string;
  content?: string;
  resolved?: boolean;
}
export const patchCommentAPI = async (params: PatchCommentAPIParams) => {
  const data: { content?: string; resolved?: boolean } = {};
  if (params.content !== undefined) data.content = params.content;
  if (params.resolved !== undefined) data.resolved = params.resolved;
  return await request<typeof data, CommentType>({
    url: `/comments/${params.id}`,
    method: "PATCH",
    data,
  });
};

// 删除评论（作者 / ADMIN / owner）
interface DeleteCommentAPIResponse {
  deleted: boolean;
}
export const deleteCommentAPI = async (id: string) => {
  return await request<null, DeleteCommentAPIResponse>({
    url: `/comments/${id}`,
    method: "DELETE",
  });
};
