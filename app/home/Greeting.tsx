import Link from "next/link";
import { FolderPlus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * 首页问候区：当前用户称呼 + 今天日期 + 快捷入口。
 * 「新建任务」直接创建一条独立任务（归属自己），创建逻辑在 HomeClient；
 * 「新建项目」跳到项目列表页（创建表单在那里）。
 */
export function Greeting({
  name,
  creating,
  onCreateTask,
}: {
  name: string;
  creating: boolean;
  onCreateTask: () => void;
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
        <p data-slot="home-today" className="mt-1 text-sm text-muted-foreground">
          {formatToday()}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          data-slot="home-new-task"
          variant="outline"
          size="sm"
          disabled={creating}
          onClick={onCreateTask}
        >
          <Plus />
          {creating ? "创建中…" : "新建任务"}
        </Button>
        {/* 这是导航链接而不是按钮动作：用 buttonVariants 给 <Link> 套按钮样式，
            避免 Base UI Button 的 render 渲染出非原生 button（nativeButton 告警 + 语义错误） */}
        <Link
          data-slot="home-new-project"
          href="/projects"
          className={buttonVariants({ size: "sm" })}
        >
          <FolderPlus />
          新建项目
        </Link>
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
