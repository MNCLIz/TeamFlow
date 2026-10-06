import { request } from "@/lib/request"
import { ActivityType } from "@/types/activity"

// 获取我参与项目的动态流（首页「动态」区块）
export const getActivityFeedAPI = async (limit: number) => {
    return await request<{ limit: string }, ActivityType[]>({
        url: '/activities',
        data: { limit: String(limit) }
    })
}
