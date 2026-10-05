/**
 * 首页各分节的标题行：标题 + 可选计数 + 右侧动作（「查看全部」等）。
 * 版式对齐项目详情页的分节标题（Projects/[id]/Details/ProjectDetails.tsx 的 SectionHeader）。
 */
export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {count !== undefined && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}
