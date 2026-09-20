export enum Priority {
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
    description: string | null
    priority: Priority
    dueDate: Date | null
    order: number
    columnId: string
    createdById: string
    assigneeId: string | null
    labels: LabelType[]
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
