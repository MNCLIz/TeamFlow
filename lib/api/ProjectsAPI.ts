import { request } from "@/lib/request"
import { MemberRole, MemberType, ProjectType } from "@/types/project"

// 获取项目详情
export const getProjectAPI = async ({ id, Cookie }: { id: string, Cookie: string }) => {
    return await request<null, ProjectType>({
        url: `/projects/${id}`,
        headers: { Cookie }
    })
}

// 创建项目
interface PostProjectsAPIParams {
    name: string
    description?: string
}
export const postProjectsAPI = async (data: PostProjectsAPIParams) => {
    return await request<PostProjectsAPIParams, ProjectType>({
        url: '/projects',
        method: 'POST',
        data
    })
}

// 获取项目列表
export const getProjectListAPI = async () => {
    return await request<null, ProjectType[]>({
        url: '/projects'
    })
}
interface PatchProjectAPIParams {
    id: string
    name?: string
    description?: string
}
export const patchProjectAPI = async (params: PatchProjectAPIParams) => {
    const data: Record<string, string> = {}
    if (params.name !== undefined) data.name = params.name
    if (params.description !== undefined) data.description = params.description
    return await request<Record<string, string>, ProjectType>({
        url: `/projects/${params.id}`,
        method: 'PATCH',
        data
    })
}

// 删除项目
interface DeleteProjectAPIRequence {
    deleted: boolean
}
export const deleteProjectAPI = async (id: string) => {
    return await request<null, DeleteProjectAPIRequence>({
        url: `/projects/${id}`,
        method: 'DELETE'
    })
}

// 退出项目（移除自己的成员身份）
interface LeaveProjectAPIResponse {
    left: boolean
}
export const leaveProjectAPI = async (id: string) => {
    return await request<null, LeaveProjectAPIResponse>({
        url: `/projects/${id}/leave`,
        method: 'POST'
    })
}

// 获取项目成员列表
export const getProjectMembersAPI = async (projectId: string) => {
    return await request<null, MemberType[]>({
        url: `/projects/${projectId}/members`
    })
}

// 添加项目成员（按邮箱 + 角色）
interface PostProjectMemberAPIParams {
    projectId: string
    email: string
    role: MemberRole
}
export const postProjectMemberAPI = async (params: PostProjectMemberAPIParams) => {
    return await request<Omit<PostProjectMemberAPIParams, "projectId">, MemberType>({
        url: `/projects/${params.projectId}/members`,
        method: 'POST',
        data: { email: params.email, role: params.role }
    })
}