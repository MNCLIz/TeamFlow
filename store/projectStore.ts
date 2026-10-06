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
  // 首次拉取是否已结束（成功或失败）；为 false 时列表显示骨架屏，为 true 后一律展示已有数据
  hasLoaded: boolean
  setProjects: (projects: ProjectType[]) => void
  addProject: (project: ProjectType) => void
  removeProject: (projectId: string) => void
  fetchProjects: () => Promise<void>
  createProject: (data: { name: string; description?: string }) => Promise<ProjectType>
  updateProject: (params: { id: string; name?: string; description?: string }) => Promise<void>
  // SSE 广播到达时就地更新（doc:updated）：只改描述与更新时间，不动其它字段，也不重新拉取
  applyDocumentUpdated: (params: {
    id: string
    markdown?: string | null
    updatedAt?: string
  }) => void
  deleteProject: (id: string) => Promise<boolean>
  leaveProject: (id: string) => Promise<boolean>
  addMember: (params: { projectId: string; email: string; role: MemberRole }) => Promise<void>
}

export const useProjectStore = create<ProjectStoreType>()(immer((set, get) => ({
  projects: [],
  isLoading: false,
  hasLoaded: false,
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
      })
    } catch {
      // 失败不额外提示，保持原有静默行为，仅结束加载态
    } finally {
      // 成功、失败都要置位：否则接口报错时骨架屏会一直不消失
      set((state) => {
        state.isLoading = false
        state.hasLoaded = true
      })
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
  // 项目描述的协作编辑由 WS 同步；这条在「协作文档快照落库」时由 SSE 送来。
  // 同步更新 description，是为了「没打开描述编辑器」的场景：任务页签/列表页/首页摘要，
  // 以及 MEMBER 的空描述 → 有描述的切换（编辑器挂不挂载由 store 里的 description 决定）。
  // 已打开编辑器时覆盖这个字段是安全的：协作态的编辑器正文来自 Y.Doc，不读 store。
  applyDocumentUpdated: (params: {
    id: string
    markdown?: string | null
    updatedAt?: string
  }) => {
    set((state) => {
      const project = state.projects.find((p) => p.id === params.id)
      if (!project) return
      if (typeof params.markdown === "string") project.description = params.markdown
      if (params.updatedAt) project.updatedAt = new Date(params.updatedAt)
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
