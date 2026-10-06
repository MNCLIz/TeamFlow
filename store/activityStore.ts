import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { getActivityFeedAPI } from "@/lib/api/ActivityAPI"
import { ActivityType } from "@/types/activity"

/**
 * 首页一次拉取的动态条数。
 * 展示条数只有 8（见 app/HomeClient.tsx），但首页要滤掉自己的操作，
 * 多拉一些才能凑满展示条数 —— 否则我自己连着做了 8 件事时，动态区会是空的。
 */
export const ACTIVITY_FETCH_LIMIT = 24

export interface ActivityStoreType {
  activities: ActivityType[]
  isLoading: boolean
  // 首次拉取是否已结束（成功或失败）；false 时首页显示骨架屏，true 后一律展示已有数据
  hasLoaded: boolean
  fetchActivities: () => Promise<void>
}

/**
 * 动态流数据（只读，无乐观更新）。
 * 与 projectStore / boardStore 同一约定：失败静默（仅结束加载态，页面落到空态），
 * 不额外弹提示 —— 首页概览不该因为动态接口挂掉就报错。
 *
 * 本期不做实时推送（进入首页拉取一次），实时方案见 AGENTS.md 的 Pending。
 */
export const useActivityStore = create<ActivityStoreType>()(immer((set) => ({
  activities: [],
  isLoading: false,
  hasLoaded: false,
  fetchActivities: async () => {
    set((state) => { state.isLoading = true })
    try {
      const activities = await getActivityFeedAPI(ACTIVITY_FETCH_LIMIT)
      set((state) => { state.activities = activities })
    } catch {
      // 失败保持原有静默行为，仅结束加载态
    } finally {
      // 成功、失败都要置位：否则接口报错时骨架屏会一直不消失
      set((state) => {
        state.isLoading = false
        state.hasLoaded = true
      })
    }
  },
})))
