import type { AttachmentType } from "@/types/file"

enum Priority {
    Low = "LOW",
    Medium = "MEDIUM",
    High = "HIGH",
}

export interface LabelType {
    id: string
    name: string
    color: string
}

// 任务卡片
export interface CardType {
    id: string
    title: string
    description: string
    content: string
    priority: Priority
    dueDate: Date
    order: number
    columnId: string
    createdById: string
    assigneeId: string
    labels: LabelType[]
    attachments: AttachmentType[]
    createdAt: Date
    updatedAt: Date
}

// 任务列
export interface ColumnType {
    id: string
    name: string
    order: number
    projectId: string
    createdAt: Date
    cards: CardType[]
}