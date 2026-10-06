import Link from "next/link";
import { CheckCircle2, Circle, CircleDashed, CircleDot } from "lucide-react";
import { cn } from "cn";
import {
  CardType,
  Priority,
  TaskState,
  TASK_STATE_LABELS,
} from "@/types/board";
import { ProjectType } from "@/types/project";
import { CardDetailDrawer } from "@/components/shared/CardDetail/CardDetailDrawer";
import { SectionHeader } from "./SectionHeader";
import { dueTime, isDueToday, isOverdue } from "./task-order";

const stateIcons: Record<TaskState, typeof CircleDashed> = {
  [TaskState.Todo]: CircleDashed,
  [TaskState.UpNext]: Circle,
  [TaskState.InProgress]: CircleDot,
  [TaskState.Done]: CheckCircle2,
};

const stateColors: Record<TaskState, string> = {
  [TaskState.Todo]: "text-muted-foreground",
  [TaskState.UpNext]: "text-blue-500",
  [TaskState.InProgress]: "text-amber-500",
  [TaskState.Done]: "text-green-500",
};

// 用半透明色替代固定浅底，深浅主题下都可读
const stateBadgeColors: Record<TaskState, string> = {
  [TaskState.Todo]: "bg-muted text-muted-foreground",
  [TaskState.UpNext]: "bg-blue-500/10 text-blue-600",
  [TaskState.InProgress]: "bg-amber-500/10 text-amber-600",
  [TaskState.Done]: "bg-emerald-500/10 text-emerald-600",
};

const priorityColors: Record<Priority, string> = {
  [Priority.High]: "bg-red-500/10 text-red-600",
  [Priority.Medium]: "bg-amber-500/10 text-amber-600",
  [Priority.Low]: "bg-emerald-500/10 text-emerald-600",
};

// 行内空间有限，用单字 + 颜色表达优先级（完整叫法见 CardDetail 的「高优先级」）
const priorityLabels: Record<Priority, string> = {
  [Priority.High]: "HIGH",
  [Priority.Medium]: "MEDIUM",
  [Priority.Low]: "LOW",
};

const priorityTitles: Record<Priority, string> = {
  [Priority.High]: "高优先级",
  [Priority.Medium]: "中优先级",
  [Priority.Low]: "低优先级",
};

/**
 * 首页「我的任务」：分配给我且未完成的任务（含独立任务），已按 task-order 排好序。
 * 行内点击复用卡片详情抽屉，不必先跳到任务列表。
 */
export function MyTasksSection({
  tasks,
  total,
  projects,
}: {
  tasks: CardType[];
  /** 未截断的总数，用于分节标题与「查看全部」入口 */
  total: number;
  projects: ProjectType[];
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="我的任务"
        count={total}
        action={
          total > 0 ? (
            <Link
              data-slot="home-all-tasks"
              href="/tasks"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              查看全部
            </Link>
          ) : null
        }
      />

      {tasks.length === 0 ? (
        <p
          data-slot="home-tasks-empty"
          className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
        >
          暂无待办任务
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border">
          {tasks.map((card) => (
            <TaskRow key={card.id} card={card} projects={projects} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  card,
  projects,
}: {
  card: CardType;
  projects: ProjectType[];
}) {
  const StateIcon = stateIcons[card.state] ?? CircleDashed;
  const project = projects.find((p) => p.id === card.projectId);
  // 独立任务（projectId 为 null）与「我不再是成员的项目」分开兜底
  const projectLabel = !card.projectId
    ? "独立任务"
    : (project?.name ?? "其他项目");

  const time = dueTime(card);
  const overdue = isOverdue(card);
  const dueToday = !overdue && isDueToday(card);

  return (
    <CardDetailDrawer card={card}>
      <div
        data-slot="home-task-row"
        data-card-id={card.id}
        className="flex cursor-pointer flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        {/* 标题 + 所属项目：窄屏占满一行，宽屏与右侧属性同行 */}
        <div className="flex min-w-0 items-center gap-2">
          <StateIcon
            className={cn("size-4 shrink-0", stateColors[card.state])}
          />
          <span className="truncate text-sm font-medium">{card.title}</span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {projectLabel}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-6 sm:pl-0">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              stateBadgeColors[card.state],
            )}
          >
            {TASK_STATE_LABELS[card.state]}
          </span>
          <span
            title={priorityTitles[card.priority]}
            className={cn(
              "rounded-full px-1.5 py-0.5 text-xs font-medium",
              priorityColors[card.priority],
            )}
          >
            {priorityLabels[card.priority] ?? card.priority}
          </span>
          {time !== null && (
            <span
              data-slot="home-task-due"
              className={cn(
                "text-xs",
                overdue
                  ? "font-medium text-destructive"
                  : dueToday
                    ? "font-medium text-amber-600"
                    : "text-muted-foreground",
              )}
            >
              {overdue
                ? `已逾期 · ${formatDue(time)}`
                : dueToday
                  ? "今天到期"
                  : formatDue(time)}
            </span>
          )}
        </div>
      </div>
    </CardDetailDrawer>
  );
}

function formatDue(time: number): string {
  return new Date(time).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
