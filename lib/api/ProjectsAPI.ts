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