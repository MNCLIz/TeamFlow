import { NewProjectButton } from "@/components/shared/NewActionButtons/NewProjectButton";
import { NewTaskButton } from "@/components/shared/NewActionButtons/NewTaskButton";

/**
 * 首页问候区：当前用户称呼 + 今天日期 + 快捷入口。
 * 两个入口都是共享组件（components/shared/NewActionButtons）：
 * 「新建任务」直接创建一条独立任务（归属自己），「新建项目」跳到项目列表页（创建表单在那里）。
 */
export function Greeting({
  name,
  assigneeId,
}: {
  name: string;
  assigneeId?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1
          data-slot="home-greeting"
          className="truncate text-2xl font-semibold tracking-tight"
        >
          你好，{name || "朋友"}
        </h1>
        <p
          data-slot="home-today"
          className="mt-1 text-sm text-muted-foreground"
        >
          {formatToday()}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NewTaskButton dataSlot="home-new-task" assigneeId={assigneeId} />
        <NewProjectButton dataSlot="home-new-project" />
      </div>
    </header>
  );
}

// 真实内容只在客户端渲染（首屏由 store 的 hasLoaded 驱动骨架屏），
// 因此这里直接取当前时间不会造成服务端/客户端水合不一致
function formatToday(): string {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}
