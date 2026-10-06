import { request } from "@/lib/request";

/** `GET /api/docs/[docName]` 的响应体 */
export interface DocStateResponse {
  docName: string;
  /** base64 编码的 Yjs 快照；null 表示服务端还没落库过 */
  state: string | null;
  /** 已落库的 Markdown 投影（没有则回退为 seedMarkdown） */
  markdown: string;
  /** 首次打开时用于播种的既有描述 */
  seedMarkdown: string;
  version: number;
  /** 服务端判定的只读（MEMBER 角色） */
  readOnly: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
  updatedAt: string | null;
}

export const getDocStateAPI = async (docName: string) => {
  return await request<never, DocStateResponse>({
    url: `/docs/${docName}`,
  });
};
