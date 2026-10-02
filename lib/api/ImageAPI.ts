import { request } from "@/lib/request";

interface PostImageAPIParams {
  file: File;
}
interface PostImageAPIResponse {
  url: string;
  key: string;
}
// 上传图片到 OSS，返回本站代理 url（/api/image?key=...），markdown 中直接存该 url
export const postImageAPI = async ({ file }: PostImageAPIParams) => {
  const formData = new FormData();
  // 字段名必须是 file，服务端按 formData.get("file") 取值
  formData.append("file", file);
  return await request<FormData, PostImageAPIResponse>({
    url: `/upload/image`,
    method: "POST",
    data: formData,
    formData: true,
  });
};
