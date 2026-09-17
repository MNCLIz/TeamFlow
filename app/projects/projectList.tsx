"use client";

import Link from "next/link";
import { useProjectStore, ProjectStoreType } from "@/store/projectStore";
import { useShallow } from "zustand/react/shallow";
import { getProjectListAPI } from "@/lib/api/ProjectsAPI";
import { useEffect, useCallback } from "react";

export function ProjectList() {
  const { projects, setProjects, addProject, removeProject } = useProjectStore(
    useShallow((state: ProjectStoreType) => ({
      projects: state.projects,
      setProjects: state.setProjects,
      addProject: state.addProject,
      removeProject: state.removeProject,
    })),
  );

  const Init = useCallback(async () => {
    const res = await getProjectListAPI();
    setProjects(res);
    console.log(res);
  }, [setProjects]);

  useEffect(() => {
    Init();
  }, [Init]);

  return (
    <>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No projects yet. Create your first project!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
              <span className="text-xs text-gray-400 mt-2 inline-block">
                {project.owner.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
