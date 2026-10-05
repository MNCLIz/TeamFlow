import { Skeleton } from "@/components/ui/skeleton";

// 每个列位的占位卡片数：模仿真实看板「未开始堆积最多」的分布
const COLUMN_CARD_ROWS = [3, 2, 2, 1];
// 卡片标题占位宽度（轮换，避免四列看起来像复制粘贴）
const CARD_TITLE_WIDTHS = ["w-32", "w-24", "w-36"];

/**
 * 任务看板骨架屏：固定四列 + 卡位 + 「新建任务」占位。
 * 容器与列的 class 对齐真实看板（TasksBoard 的 flex-wrap 容器、Column 的 w-72/p-3 圆角列），
 * 占位块尺寸对齐真实元素，避免数据到达时布局跳动；由 boardStore.loadedProjectId 驱动。
 */
export function TasksBoardSkeleton() {
  return (
    <div
      data-slot="tasks-board-skeleton"
      role="status"
      aria-busy="true"
      className="flex flex-wrap items-start gap-4 p-4"
    >
      <span className="sr-only">加载中…</span>

      {COLUMN_CARD_ROWS.map((cardRows, columnIndex) => (
        <div
          key={columnIndex}
          data-slot="tasks-board-skeleton-column"
          className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-3"
        >
          {/* 列标题（对齐真实列标题的 px-2 py-1 text-sm） */}
          <Skeleton className="mb-3 h-7 w-20 rounded-lg" />

          <div className="flex-1">
            {Array.from({ length: cardRows }, (_, cardIndex) => (
              <div
                key={cardIndex}
                data-slot="tasks-board-skeleton-card"
                className="my-2 flex items-center gap-2 rounded border bg-background p-3 shadow-sm"
              >
                {/* 拖拽手柄占位 */}
                <Skeleton className="size-3.5 shrink-0 rounded-sm" />
                <Skeleton
                  className={`h-4 ${CARD_TITLE_WIDTHS[cardIndex % CARD_TITLE_WIDTHS.length]}`}
                />
              </div>
            ))}
          </div>

          {/* 「+ 新建任务」按钮占位（对齐真实按钮 p-3 + text-sm 的 h-11） */}
          <Skeleton className="mt-2 h-11 w-full rounded" />
        </div>
      ))}
    </div>
  );
}
