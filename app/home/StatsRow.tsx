import { cn } from "cn";

/**
 * 首页概览统计：四个数字卡。
 * 口径见 app/home/task-order.ts（「待我处理 / 进行中 / 已逾期」都只看分配给我的未完成任务）。
 */
export function StatsRow({
  projectCount,
  openTaskCount,
  inProgressCount,
  overdueCount,
}: {
  projectCount: number;
  openTaskCount: number;
  inProgressCount: number;
  overdueCount: number;
}) {
  const stats = [
    { key: "projects", label: "参与项目", value: projectCount },
    { key: "open", label: "待我处理", value: openTaskCount },
    { key: "in-progress", label: "进行中", value: inProgressCount },
    {
      key: "overdue",
      label: "已逾期",
      value: overdueCount,
      danger: overdueCount > 0,
    },
  ];

  return (
    <section aria-label="概览统计" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.key}
          data-slot="home-stat"
          data-stat={stat.key}
          className="rounded-lg border p-4"
        >
          <div
            data-slot="home-stat-value"
            className={cn(
              "text-2xl font-semibold tabular-nums",
              stat.danger && "text-destructive",
            )}
          >
            {stat.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </section>
  );
}
