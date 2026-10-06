"use client";

import { useState, type ComponentProps } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDetailDrawer } from "@/components/shared/CardDetail/CardDetailDrawer";
import { postCreateStandaloneCardAPI } from "@/lib/api/BoardAPI";
import { useBoardStore } from "@/store/boardStore";
import type { CardType } from "@/types/board";

// 与 Button 的 size 变体保持一致（首页用 sm，列表页用 default）
type ButtonSize = ComponentProps<typeof Button>["size"];

/**
 * 「新建任务」按钮：一键创建独立任务（不绑定项目）、刷新任务列表，并自动打开这条任务的详情抽屉。
 * 首页与全部任务列表页共用；两处的差异只在按钮大小与是否提示成功。
 */
export function NewTaskButton({
  assigneeId,
  size = "sm",
  dataSlot = "new-task-button",
  className,
}: {
  // 传了就直接指派（首页快捷新建指派给自己，创建后立刻出现在「我的任务」里）
  assigneeId?: string;
  size?: ButtonSize;
  // 创建成功后的提示文案；不传则静默（全部任务列表页保持原有行为）
  successMessage?: string;
  dataSlot?: string;
  className?: string;
}) {
  const [creating, setCreating] = useState(false);
  // 新建的这条：详情抽屉跟着它打开，用户关掉抽屉后保留 id，列表里的编辑仍会同步进来
  const [createdCard, setCreatedCard] = useState<CardType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const fetchCards = useBoardStore((state) => state.fetchCards);
  const cards = useBoardStore((state) => state.cards);

  // 优先取 store 里的那条（抽屉内改状态/优先级后跟着更新），列表还没刷回来时退回创建响应
  const detailCard = createdCard
    ? (cards.find((card) => card.id === createdCard.id) ?? createdCard)
    : undefined;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const card = await postCreateStandaloneCardAPI({
        title: "新任务",
        assigneeId,
      });
      // 独立任务不进看板 columns，重新拉一次扁平列表即可
      await fetchCards();
      // 建完直接打开详情，省掉「去列表里找刚建的那条」这一步
      setCreatedCard(card);
      setDetailOpen(true);
    } catch {
      toast.error("创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        data-slot={dataSlot}
        variant="outline"
        size={size}
        className={className}
        disabled={creating}
        onClick={handleCreate}
      >
        <Plus />
        {creating ? "创建中…" : "新建任务"}
      </Button>
      {detailCard && (
        <CardDetailDrawer
          card={detailCard}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </>
  );
}
