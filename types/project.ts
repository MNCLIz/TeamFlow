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
}

