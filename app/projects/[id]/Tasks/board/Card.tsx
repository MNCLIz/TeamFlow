"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CardType } from "@/types/board";
import { Priority } from "@/types/board";
import { useBoardStore } from "@/store/boardStore";
import { DeleteAlertDialog } from "@/components/shared/DeleteAlertDialog";

const priorityDotColor: Record<Priority, string> = {
  [Priority.High]: "bg-red-500",
  [Priority.Medium]: "bg-yellow-500",
  [Priority.Low]: "bg-green-500",
};
import { CardDetailDrawer } from "./CardDetailDrawer";

interface CardItemProps {
  card: CardType;
  projectId: string;
}

export function CardItem({ card }: CardItemProps) {
  const removeCard = useBoardStore((state) => state.removeCard);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 删除卡片
  const handleDelete = async (id: string) => {
    try {
      await removeCard(id);
    } catch {
      toast.error("删除卡片失败");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group relative flex  items-center gap-2 bg-white p-3 my-2 rounded shadow-sm border hover:shadow-md transition-shadow"
    >
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none select-none text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </div>
      <CardDetailDrawer card={card}>
        <div className="min-w-0">
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${priorityDotColor[card.priority]}`}
            />
            {card.title}
          </h4>
        </div>
      </CardDetailDrawer>
      <div className="mt-1 absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DeleteAlertDialog id={card.id} confirmDelete={handleDelete}>
          <Trash2
            size={28}
            className="p-1 rounded text-muted-foreground hover:bg-red-100 hover:text-red-500 transition-colors"
          />
        </DeleteAlertDialog>
      </div>
    </div>
  );
}
