"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  CheckCircle2,
  Folder,
  SignalHigh,
  SignalLow,
  SignalMedium,
  X,
} from "lucide-react";
import { CardType, Priority, TaskState } from "@/types/board";
import { MdEditor, type MdEditorHandle } from "../MdEditor";
import { MdFileActions } from "@/components/shared/MdEditor/MdFileActions";
import { CardComments } from "@/components/shared/Comments/CardComments";
import { useBoardStore } from "@/store/boardStore";
import { useProjectStore } from "@/store/projectStore";
import { useUserDataStore } from "@/store/userDataStore";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { DrawerClose } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 属性控件（状态/优先级/截止日期）统一的可点击 pill 样式
const triggerBase =
  "group inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const triggerClass = `${triggerBase} text-muted-foreground hover:text-foreground`;

const statusConfig: {
  label: string;
  icon: typeof CircleDashed;
  color: string;
  name: TaskState;
}[] = [
  {
    label: "未开始",
    icon: CircleDashed,
    color: "text-muted-foreground",
    name: TaskState.Todo,
  },
  {
    label: "接下来",
    icon: Circle,
    color: "text-blue-500",
    name: TaskState.UpNext,
  },
  {
    label: "进行中",
    icon: CircleDot,
    color: "text-amber-500",
    name: TaskState.InProgress,
  },
  {
    label: "已完成",
    icon: CheckCircle2,
    color: "text-green-500",
    name: TaskState.Done,
  },
];

const priorityConfig: Record<
  Priority,
  { label: string; icon: typeof SignalHigh; color: string }
> = {
  [Priority.High]: {
    label: "高优先级",
    icon: SignalHigh,
    color: "text-red-500",
  },
  [Priority.Medium]: {
    label: "中优先级",
    icon: SignalMedium,
    color: "text-amber-500",
  },
  [Priority.Low]: {
    label: "低优先级",
    icon: SignalLow,
    color: "text-green-500",
  },
};

// 截止日期：当年只显示月日，跨年补上年份
function formatDueDate(date: Date): string {
  const currentYear = new Date().getFullYear();
  return date.toLocaleDateString("zh-CN", {
    ...(date.getFullYear() === currentYear ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
  });
}

export function CardDetail({ card }: { card: CardType }) {
  const [title, setTitle] = useState(card.title);
  // 供「导出 Markdown」读取编辑器当前正文
  const editorRef = useRef<MdEditorHandle>(null);

  const updateDescription = useBoardStore(
    (state) => state.updateCardDescription,
  );

  const projects = useProjectStore((state) => state.projects);
  const project = projects.find((p) => p.id === card.projectId);

  const { name, role } = project ?? {};

  const readOnly = role === "MEMBER";

  const currentUserId = useUserDataStore((state) => state.id);
  // 与后端删除权限一致：项目内为作者本人 / 项目 ADMIN / 项目 owner；
  // 独立任务（无项目）没有项目角色，改为任务创建者可管理
  const canModerate = card.projectId
    ? role === "ADMIN" || project?.owner?.id === currentUserId
    : card.createdById === currentUserId;

  const status =
    statusConfig.find((s) => s.name === card.state) ?? statusConfig[0];
  const StatusIcon = status.icon;
  const priority =
    priorityConfig[card.priority] ?? priorityConfig[Priority.Medium];
  const PriorityIcon = priority.icon;

  // dueDate 经 JSON 序列化后是 ISO 字符串（不是 Date），统一转成 Date 再判空
  const parsedDue = card.dueDate ? new Date(card.dueDate) : null;
  const dueDate =
    parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue =
    dueDate !== null &&
    card.state !== TaskState.Done &&
    dueDate.getTime() < startOfToday.getTime();

  // 处理修改卡片属性
  const updateCard = useBoardStore((state) => state.updateCard);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 头部：项目面包屑 + 关闭、标题、属性区，固定在顶部不随内容滚动 */}
      <header className="shrink-0 border-b px-5 pt-3.5 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Folder className="size-3.5 shrink-0" />
          {card.projectId && name ? (
            <Link
              href={`/projects/${card.projectId}`}
              className="truncate transition-colors hover:text-foreground hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="truncate">独立任务</span>
          )}
          <span className="mx-0.5 text-muted-foreground/50">/</span>
          <span className="shrink-0">任务</span>

          <DrawerClose
            aria-label="关闭任务详情"
            title="关闭"
            className="ml-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </DrawerClose>
        </div>

        <EditableTitle
          id={card.id}
          value={title}
          onChange={setTitle}
          readOnly={readOnly}
          updateName={updateDescription}
          className="mt-2 text-xl font-semibold tracking-tight"
        />

        {/* 属性区：状态 / 优先级 / 截止日期，均可点击修改 */}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {/* 状态 */}
          <DropdownMenu>
            <DropdownMenuTrigger className={triggerClass}>
              <StatusIcon className={`size-3.5 ${status.color}`} />
              {status.label}
              {!readOnly && (
                <ChevronDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-[140px]">
              {statusConfig.map((s) => {
                const Icon = s.icon;
                const active = s.label === status.label;
                return (
                  <DropdownMenuItem
                    key={s.label}
                    className="cursor-pointer"
                    onClick={() => {
                      if (readOnly) return;
                      updateCard({
                        id: card.id,
                        state: s.name,
                      });
                    }}
                  >
                    <Icon className={`size-4 ${s.color}`} />
                    {s.label}
                    {active && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 优先级 */}
          <DropdownMenu>
            <DropdownMenuTrigger className={triggerClass}>
              <PriorityIcon className={`size-3.5 ${priority.color}`} />
              {priority.label}
              {!readOnly && (
                <ChevronDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-[140px]">
              {Object.entries(priorityConfig).map(([value, p]) => {
                const Icon = p.icon;
                const active = value === card.priority;
                return (
                  <DropdownMenuItem
                    key={value}
                    className="cursor-pointer"
                    onClick={() => {
                      if (readOnly) return;
                      updateCard({ id: card.id, priority: value as Priority });
                    }}
                  >
                    <Icon className={`size-4 ${p.color}`} />
                    {p.label}
                    {active && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 截止日期：只读成员不看空占位 */}
          {(dueDate || !readOnly) && (
            <button
              type="button"
              className={`${triggerBase} ${
                overdue
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5" />
              {dueDate ? formatDueDate(dueDate) : "设置截止日期"}
            </button>
          )}
        </div>
      </header>

      {/* 内容区：整块滚动（评论 + 描述） */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* 卡片评论：放在描述上方（独立任务的评论没有项目与 @提及，但同样可评论） */}
        <CardComments
          cardId={card.id}
          projectId={card.projectId}
          currentUserId={currentUserId}
          canModerate={canModerate}
        />

        <div className="my-5 h-px bg-border" />

        <section>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">描述</h2>
            <MdFileActions
              className="ml-auto"
              variant="menu"
              editorRef={editorRef}
              title={title}
              fallbackId={card.id}
              readOnly={readOnly}
            />
          </div>
          <MdEditor
            ref={editorRef}
            id={card.id}
            defaultValue={card.description ?? ""}
            readOnly={readOnly}
            placeholder="添加描述…"
            wrapperClassName="mt-2 text-sm text-foreground/80"
            updateDescription={updateDescription}
          />
        </section>
      </div>
    </div>
  );
}
