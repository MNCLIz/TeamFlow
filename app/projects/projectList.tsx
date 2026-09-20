"use client";

import Link from "next/link";
import { useProjectStore, ProjectStoreType } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useCallback } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { DeleteAlertDialog } from "@/components/shared/DeleteAlertDialog";

export function ProjectList() {
  const { projects, fetchProjects, deleteProject } = useProjectStore(
    useShallow((state: ProjectStoreType) => ({
      projects: state.projects,
      fetchProjects: state.fetchProjects,
      deleteProject: state.deleteProject,
    })),
  );

  const handleDelete = useCallback(
    async (projectId: string) => {
      const deleted = await deleteProject(projectId);
      if (!deleted) toast.error("Failed to delete project");
    },
    [deleteProject],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No projects yet. Create your first project!
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

              <div className="flex items-center">
                <Avatar size="sm">
                  <AvatarImage src={project.owner.image!} />
                </Avatar>
                <span className="text-xs text-gray-400 mx-2 shrink-0">
                  {project.owner.name}
                </span>
                <DeleteAlertDialog
                  id={project.id}
                  confirmDelete={handleDelete}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
