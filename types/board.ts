export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type MemberRole = "ADMIN" | "MEMBER";
export type ActivityAction =
  | "CREATE_CARD"
  | "UPDATE_CARD"
  | "MOVE_CARD"
  | "DELETE_CARD"
  | "ADD_MEMBER"
  | "REMOVE_MEMBER"
  | "CREATE_COLUMN"
  | "DELETE_COLUMN";

export interface BoardColumn {
  id: string;
  name: string;
  order: number;
  cards: BoardCard[];
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string | null;
  priority: Priority;
  dueDate?: Date | null;
  order: number;
  columnId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardData {
  projectId: string;
  projectName: string;
  columns: BoardColumn[];
}
