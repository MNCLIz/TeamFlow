export enum Priority {
    Low = "LOW",
    Medium = "MEDIUM",
    High = "HIGH",
}

// 任务状态
export enum TaskState {
    Todo = "TODO",
    UpNext = "UP_NEXT",
    InProgress = "IN_PROGRESS",
    Done = "DONE",
}

// 看板列固定顺序
export const TASK_STATE_ORDER: TaskState[] = [
    TaskState.Todo,
    TaskState.UpNext,
    TaskState.InProgress,
    TaskState.Done,
];

export const TASK_STATE_LABELS: Record<TaskState, string> = {
    [TaskState.Todo]: "未开始",
    [TaskState.UpNext]: "接下来",
    [TaskState.InProgress]: "进行中",
    [TaskState.Done]: "已完成",
};

// 任务卡片
export interface CardType {
    id: string
    title: string
    description: string | null
    priority: Priority
    dueDate: Date | null
    order: number
    state: TaskState
    projectId: string | null
    createdById: string
    assigneeId: string | null
    createdAt: Date
    updatedAt: Date
}

// 看板列（按 state 分组）
export interface ColumnType {
    state: TaskState
    name: string
    projectId: string
    cards: CardType[]
}
