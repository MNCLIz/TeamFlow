"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";

// 与 Button 的 size 变体保持一致（首页用 sm，列表页用 default）
type ButtonSize = ComponentProps<typeof Button>["size"];

/**
 * 「新建项目」按钮：首页与项目列表页共用。
 * - 传 href：渲染成导航链接（首页跳到项目列表页，创建表单在那里）
 * - 不传 href：就地创建项目并进入新项目（项目列表页）
 * 两处的差异只在按钮大小（size）。
 */
export function NewProjectButton({
  size = "sm",
  dataSlot = "new-project-button",
  className,
}: {
  href?: string;
  size?: ButtonSize;
  dataSlot?: string;
  className?: string;
}) {
  const router = useRouter();
  const createProject = useProjectStore((state) => state.createProject);
  const [creating, setCreating] = useState(false);

  const handleCreateProject = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const project = await createProject({ name: "新项目" });
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error("创建项目失败");
      setCreating(false);
    }
  };

  return (
    <Button
      data-slot={dataSlot}
      size={size}
      className={className}
      disabled={creating}
      onClick={handleCreateProject}
    >
      <FolderPlus />
      {creating ? "创建中…" : "新建项目"}
    </Button>
  );
}
