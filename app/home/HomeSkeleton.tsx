import { Skeleton } from "@/components/ui/skeleton";

const STAT_ROWS = 4;
const TASK_ROWS = 4;
const PROJECT_CARDS = 4;

/**
 * 首页骨架屏：问候区 + 统计卡 + 我的任务 + 最近项目。
 * 容器内边距与各块尺寸对齐真实内容（app/HomeClient.tsx），
 * 避免数据到达时布局跳动；由 store 的 hasLoaded / hasLoadedCards 驱动。
 */
export function HomeSkeleton() {
  return (
    <div
      data-slot="home-skeleton"
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-4xl space-y-8 p-6 sm:p-8"
    >
      <span className="sr-only">加载中…</span>

      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: STAT_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-[74px] rounded-lg" />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex flex-col divide-y rounded-lg border">
          {Array.from({ length: TASK_ROWS }, (_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: PROJECT_CARDS }, (_, index) => (
            <Skeleton key={index} className="h-[94px] rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
