import { request } from "@/lib/request";
import { CommentType, type CommentMentionInput } from "@/types/comment";

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

// 创建评论（cardId 与 projectId 二选一；传 parentId 表示引用某条评论；mentions 为 @提及的成员与位置）
interface PostCommentAPIParams {
  cardId?: string;
  projectId?: string;
  content: string;
  parentId?: string;
  mentions?: CommentMentionInput[];
}
export const postCommentAPI = async (params: PostCommentAPIParams) => {
  return await request<PostCommentAPIParams, CommentType>({
    url: `/comments`,
    method: "POST",
    data: params,
  });
};

// 更新评论：content / mentions 仅作者可改，resolved 任何成员可改
// mentions 为全量替换（传 [] 清空），位置相对本次提交的 content
interface PatchCommentAPIParams {
  id: string;
  content?: string;
  resolved?: boolean;
  mentions?: CommentMentionInput[];
}
export const patchCommentAPI = async (params: PatchCommentAPIParams) => {
  const data: {
    content?: string;
    resolved?: boolean;
    mentions?: CommentMentionInput[];
  } = {};
  if (params.content !== undefined) data.content = params.content;
  if (params.resolved !== undefined) data.resolved = params.resolved;
  if (params.mentions !== undefined) data.mentions = params.mentions;
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

// 标记项目级讨论已读：把水位线推进到指定时间（不传表示推进到最新一条评论）
interface PostCommentReadAPIParams {
  projectId: string;
  lastReadAt?: string;
}
interface PostCommentReadAPIResponse {
  lastReadAt: string | null;
}
export const postCommentReadAPI = async (params: PostCommentReadAPIParams) => {
  return await request<{ lastReadAt?: string }, PostCommentReadAPIResponse>({
    url: `/projects/${params.projectId}/comments/read`,
    method: "POST",
    data: params.lastReadAt === undefined ? {} : { lastReadAt: params.lastReadAt },
  });
};
