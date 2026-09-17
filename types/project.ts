import { UserType } from "@/types/user";
import { ColumnType } from "@/types/board";

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
  ownId: string;
  createdAt: Date;
  updatedAt: Date;
  role: MemberRole;
  owner: UserType;
  members: MemberType[];
  columns: ColumnType[];
  activity: number;
}

