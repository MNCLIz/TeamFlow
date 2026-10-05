"use client";

import Link from "next/link";
import { useProjectStore, ProjectStoreType } from "@/store/projectStore";
import { useUserDataStore } from "@/store/userDataStore";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useCallback } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { DeleteAlertDialog } from "@/components/shared/DeleteAlertDialog";
import { ListSkeleton } from "@/components/shared/ListSkeleton/ListSkeleton";

export function ProjectList() {
  const { projects, hasLoaded, fetchProjects, deleteProject, leaveProject } =
    useProjectStore(
      useShallow((state: ProjectStoreType) => ({
        projects: state.projects,
        hasLoaded: state.hasLoaded,
        fetchProjects: state.fetchProjects,
        deleteProject: state.deleteProject,
        leaveProject: state.leaveProject,
      })),
    );
  const currentUserId = useUserDataStore((state) => state.id);

  const handleDelete = useCallback(
    async (projectId: string) => {
      const deleted = await deleteProject(projectId);
      if (!deleted) toast.error("删除项目失败");
    },
    [deleteProject],
  );

  const handleLeave = useCallback(
    async (projectId: string) => {
      const left = await leaveProject(projectId);
      if (!left) toast.error("退出项目失败");
    },
    [leaveProject],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 首次加载未结束前显示骨架屏（含首帧，避免空态闪现）；已加载过则保留旧数据静默刷新
  if (!hasLoaded) {
    return <ListSkeleton variant="project" />;
  }

  return (
    <>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          还没有项目，创建你的第一个项目吧
        </p>
      ) : (
        <div className="flex flex-col divide-y  rounded-lg">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium truncate">{project.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(project.updatedAt).toLocaleDateString("zh-CN", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <Avatar size="sm">
                  <AvatarImage src={project.owner.image!} />
                </Avatar>
                <span className="text-xs text-gray-400 shrink-0">
                  {project.owner.name}
                </span>
                {/* owner 显示删除按钮，其他成员显示退出按钮 */}
                {project.ownerId === currentUserId ? (
                  <DeleteAlertDialog
                    id={project.id}
                    confirmDelete={handleDelete}
                  />
                ) : (
                  <DeleteAlertDialog
                    id={project.id}
                    confirmDelete={handleLeave}
                    title="确认退出项目?"
                    description="退出后将无法访问该项目，需重新被邀请才能加入"
                  >
                    <LogOut
                      size={32}
                      className="px-2 border rounded-lg hover:bg-gray-200 hover:text-gray-600"
                    />
                  </DeleteAlertDialog>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
