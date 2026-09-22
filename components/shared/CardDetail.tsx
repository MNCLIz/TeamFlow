"use client";

import { useState } from "react";
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
} from "lucide-react";
import { CardType, Priority, TaskState } from "@/types/board";
import { MdEditor } from "./MdEditor";
import { useBoardStore } from "@/store/boardStore";
import { useProjectStore } from "@/store/projectStore";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 属性控件（状态/优先级/截止日期）统一的可点击 pill 样式
const triggerClass =
  "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer";

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

export function CardDetail({ card }: { card: CardType }) {
  const [title, setTitle] = useState(card.title);

  const updateDescription = useBoardStore(
    (state) => state.updateCardDescription,
  );

  const projects = useProjectStore((state) => state.projects);
  const projectName = projects.find((p) => p.id === card.projectId)?.name;

  const status =
    statusConfig.find((s) => s.name === card.state) ?? statusConfig[0];
  const StatusIcon = status.icon;
  const priority =
    priorityConfig[card.priority] ?? priorityConfig[Priority.Medium];
  const PriorityIcon = priority.icon;

  // 处理修改卡片属性
  const updateCard = useBoardStore((state) => state.updateCard);

  return (
    <div className="p-4">
      <EditableTitle
        id={card.id}
        value={title}
        onChange={setTitle}
        readOnly={false}
        updateName={updateDescription}
      />

      {/* 属性区：状态 / 优先级 / 截止日期 / 项目，均可点击修改 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {/* 状态 */}
        <DropdownMenu>
          <DropdownMenuTrigger className={triggerClass}>
            <StatusIcon className={`size-3.5 ${status.color}`} />
            {status.label}
            <ChevronDown className="size-3 opacity-60" />
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
            <ChevronDown className="size-3 opacity-60" />
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

        {/* 截止日期 */}
        <button type="button" className={triggerClass}>
          <Calendar className="size-3.5" />
          {card.dueDate ? card.dueDate.toLocaleDateString() : "设置截止日期"}
        </button>

        {/* 项目 */}
        {card.projectId && projectName && (
          <Link href={`/projects/${card.projectId}`} className={triggerClass}>
            <Folder className="size-3.5" />
            {projectName}
          </Link>
        )}
      </div>

      <Separator className="my-4" />

      <div className="mb-2 text-xs font-medium text-muted-foreground">描述</div>
      <MdEditor
        id={card.id}
        defaultValue={card.description ?? ""}
        updateDescription={updateDescription}
      />
    </div>
  );
}
