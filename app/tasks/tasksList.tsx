"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  CircleDashed,
  Circle,
  CircleDot,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  CardType,
  Priority,
  TaskState,
  TASK_STATE_LABELS,
} from "@/types/board";
import { useBoardStore } from "@/store/boardStore";
import { DeleteAlertDialog } from "@/components/shared/DeleteAlertDialog";
import { CardDetailDrawer } from "@/components/shared/CardDetail/CardDetailDrawer";
import { useProjectStore } from "@/store/projectStore";

const priorityColors: Record<Priority, string> = {
  [Priority.High]: "text-red-600 bg-red-50",
  [Priority.Medium]: "text-yellow-600 bg-yellow-50",
  [Priority.Low]: "text-green-600 bg-green-50",
};

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

const stateBadgeColors: Record<TaskState, string> = {
  [TaskState.Todo]: "bg-gray-100 text-gray-600",
  [TaskState.UpNext]: "bg-orange-100 text-orange-700",
  [TaskState.InProgress]: "bg-cyan-100 text-cyan-700",
  [TaskState.Done]: "bg-emerald-100 text-emerald-700",
};

interface TasksListProps {
  cards: CardType[];
}

export function TasksList({ cards }: TasksListProps) {
  const removeCard = useBoardStore((state) => state.removeCard);

  const projects = useProjectStore((state) => state.projects);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeCard(id);
      } catch {
        toast.error("删除任务失败");
      }
    },
    [removeCard],
  );

  if (cards.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        No tasks yet. Create your first task!
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y rounded-lg">
      {cards.map((card) => {
        const StateIcon = stateIcons[card.state] ?? CircleDashed;
        const stateColor = stateColors[card.state] ?? "text-muted-foreground";
        const project = projects.find((p) => p.id === card.projectId);
        const role = project?.role ?? "ADMIN";
        const readOnly = role === "MEMBER";

        return (
          <div
            key={card.id}
            className="group relative flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <CardDetailDrawer card={card}>
              <div className="min-w-0 flex-1 cursor-pointer flex items-center justify-between gap-3">
                <h3 className="font-medium truncate flex items-center gap-2">
                  <StateIcon className={`size-4 shrink-0 ${stateColor}`} />
                  {card.title}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateBadgeColors[card.state]}`}
                  >
                    {TASK_STATE_LABELS[card.state]}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityColors[card.priority]}`}
                  >
                    {card.priority}
                  </span>
                  {card.dueDate && (
                    <span className="text-xs text-gray-400">
                      {new Date(card.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">
                    {new Date(card.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardDetailDrawer>

            {!readOnly && (
              <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ml-4 shrink-0">
                <DeleteAlertDialog id={card.id} confirmDelete={handleDelete}>
                  <Trash2
                    size={28}
                    className="p-1 rounded text-muted-foreground hover:bg-red-100 hover:text-red-500 transition-colors"
                  />
                </DeleteAlertDialog>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
