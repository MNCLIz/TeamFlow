import { create } from "zustand"
import { MemberRole, ProjectType } from "@/types/project"
import { immer } from "zustand/middleware/immer"
import {
  getProjectListAPI,
  postProjectsAPI,
  patchProjectAPI,
  deleteProjectAPI,
  leaveProjectAPI,
  postProjectMemberAPI,
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
  leaveProject: (id: string) => Promise<boolean>
  addMember: (params: { projectId: string; email: string; role: MemberRole }) => Promise<void>
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
  },
  deleteProject: async (id) => {
    const result = await deleteProjectAPI(id)
    if (result.deleted) {
      get().removeProject(id)
    }
    return result.deleted
  },
  // 退出项目成功后从本地列表移除该项目
  leaveProject: async (id) => {
    const result = await leaveProjectAPI(id)
    if (result.left) {
      get().removeProject(id)
    }
    return result.left
  },
  // 添加成员成功后写入对应项目的 members 列表
  addMember: async ({ projectId, email, role }) => {
    const member = await postProjectMemberAPI({ projectId, email, role })
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId)
      if (project) {
        project.members.push(member)
      }
    })
  },
})))
