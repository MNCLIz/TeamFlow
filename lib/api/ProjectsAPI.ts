import { request } from "@/lib/request"
import { ProjectType } from "@/types/project"

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