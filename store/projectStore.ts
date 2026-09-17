import { create } from "zustand"
import { ProjectType } from "@/types/project"
import { immer } from "zustand/middleware/immer" 

export interface ProjectStoreType {
  projects: ProjectType[]
  setProjects: (projects: ProjectType[]) => void
  addProject: (project: ProjectType) => void
  removeProject: (projectId: string) => void
}

export const useProjectStore = create<ProjectStoreType>()(immer((set) => ({
  projects: [],
  setProjects: (projects) => set(() => ({ projects })),
  addProject: (project) => {
    set((state) => ({
      ...state.projects,
      project,
    }))
  },
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
    }))
})))