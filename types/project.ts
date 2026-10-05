import { UserType } from "@/types/user";

export type MemberRole = "ADMIN" | "MEMBER";

export interface MemberType {
  id: string;
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  user: UserType
}

export interface ProjectType {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  role: MemberRole;
  owner: UserType;
  members: MemberType[];
  activity: number;
  // 当前用户对项目级讨论的已读水位线（仅 GET 项目详情下发，值为最后已读评论的 createdAt）
  lastReadAt?: string | null;
  // 打开项目时的未读起点（第一条未读的未解决评论 id，null 表示没有未读）；分割线插在它之前
  firstUnreadCommentId?: string | null;
}

