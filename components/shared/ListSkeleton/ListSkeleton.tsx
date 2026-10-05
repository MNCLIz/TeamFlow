import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

type ListSkeletonVariant = "project" | "task";

interface ListSkeletonProps {
  /** 列表形态：project = 项目列表，task = 全部任务列表 */
  variant?: ListSkeletonVariant;
  /** 占位行数，默认 6 */
  rows?: number;
  className?: string;
}

/**
 * 列表骨架屏：项目列表（/projects）与全部任务列表（/tasks）共用。
 * 容器与行外壳沿用真实行的 class（divide-y / px-4 py-3），占位块尺寸对齐真实元素，
 * 避免骨架屏切到真实数据时产生布局跳动。
 */
export function ListSkeleton({
  variant = "project",
  rows = 6,
  className,
}: ListSkeletonProps) {
  return (
    <div
      data-slot="list-skeleton"
      role="status"
      aria-busy="true"
      className={cn("flex flex-col divide-y rounded-lg", className)}
    >
      <span className="sr-only">加载中…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          data-slot="list-skeleton-row"
          className="flex items-center justify-between px-4 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {variant === "task" && (
              <Skeleton className="size-4 shrink-0 rounded-full" />
            )}
            <Skeleton
              className={cn("h-4", variant === "task" ? "w-48" : "w-40")}
            />
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center",
              variant === "task" ? "gap-2" : "gap-3",
            )}
          >
            {variant === "project" ? (
              <>
                <Skeleton className="h-3 w-12" />
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </>
            ) : (
              <>
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </>
            )}
            {/* 尾部操作位：对齐真实行的 size={32} 图标按钮，保证行高一致 */}
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
