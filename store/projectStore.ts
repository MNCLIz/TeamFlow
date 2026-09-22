import { create } from "zustand"
import { ProjectType } from "@/types/project"
import { immer } from "zustand/middleware/immer"
import {
  getProjectListAPI,
  postProjectsAPI,
  patchProjectAPI,
  deleteProjectAPI,
} from "@/lib/api/ProjectsAPI"

export interface ProjectStoreType {
  projects: ProjectType[]
  isLoading: boolean
  setProjects: (projects: ProjectType[]) => void
  addProject: (project: ProjectType) => void
  removeProject: (projectId: string) => void
  fetchProjects: () => Promise<void>
  createProject: (data: { name: string; description?: string }) => Promise<ProjectType>
  updateProject: (params: { id: string; name?: string; description?: string }) => Promise<void>
  deleteProject: (id: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectStoreType>()(immer((set, get) => ({
  projects: [],
  isLoading: false,
  setProjects: (projects) => set(() => ({ projects })),
  addProject: (project) => {
    set((state) => ({
      projects: [project, ...state.projects],
    }))
  },
  removeProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
    })),
  fetchProjects: async () => {
    set((state) => { state.isLoading = true })
    try {
      const projects = await getProjectListAPI()
      set((state) => {
        state.projects = projects
        state.isLoading = false
      })
    } catch {
      set((state) => { state.isLoading = false })
    }
  },
  createProject: async (data) => {
    const project = await postProjectsAPI(data)
    get().addProject(project)
    return project
  },
  updateProject: async (params) => {
    const project = await patchProjectAPI(params)
    set((state) => {
      const idx = state.projects.findIndex((p) => p.id === params.id)
      if (idx !== -1) {
        state.projects[idx] = project
      }
    })
    // return project
  },
  deleteProject: async (id) => {
    const result = await deleteProjectAPI(id)
    if (result.deleted) {
      get().removeProject(id)
    }
    return result.deleted
  },
})))
