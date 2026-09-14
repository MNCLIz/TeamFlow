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

export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

export interface CardAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  priority: Priority;
  dueDate?: Date | null;
  order: number;
  columnId: string;
  createdById: string;
  assigneeId?: string | null;
  labels: CardLabel[];
  attachments: CardAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardData {
  projectId: string;
  projectName: string;
  columns: BoardColumn[];
}
