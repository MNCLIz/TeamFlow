"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/store/projectStore";
import { useBoardStore } from "@/store/boardStore";
import { useActivityStore } from "@/store/activityStore";
import { useUserDataStore } from "@/store/userDataStore";
import { TaskState } from "@/types/board";
import { Greeting } from "./home/Greeting";
import { StatsRow } from "./home/StatsRow";
import { MyTasksSection } from "./home/MyTasksSection";
import { RecentProjectsSection } from "./home/RecentProjectsSection";
import { ActivityFeedSection } from "./home/ActivityFeedSection";
import { HomeSkeleton } from "./home/HomeSkeleton";
import { isMyOpenTask, isOverdue, sortMyTasks } from "./home/task-order";

// 「我的任务」最多列前 8 条，超出走「查看全部」；最近项目取 4 个（接口已按 updatedAt 倒序）；
// 动态取 8 条（store 多拉一些，因为要滤掉自己的操作）
const MY_TASK_LIMIT = 8;
const RECENT_PROJECT_LIMIT = 4;
const ACTIVITY_LIMIT = 8;

/**
 * 首页概览（登录后的工作台）：问候 + 统计 + 我的任务 + 最近项目 + 动态。
 * 前四块复用 /projects、/tasks 已有的两个 store（projectStore / boardStore），不新增接口；
 * 「动态」来自 GET /api/activities（activityStore），是首页唯一的专属接口。
 * 汇总口径集中在 app/home/task-order.ts 与 lib/activity.ts，子组件只负责展示。
 */
export function HomeClient() {
  const { projects, hasLoaded, fetchProjects } = useProjectStore(
    useShallow((state) => ({
      projects: state.projects,
      hasLoaded: state.hasLoaded,
      fetchProjects: state.fetchProjects,
    })),
  );
  const { cards, hasLoadedCards, fetchCards } = useBoardStore(
    useShallow((state) => ({
      cards: state.cards,
      hasLoadedCards: state.hasLoadedCards,
      fetchCards: state.fetchCards,
    })),
  );
  const { activities, hasLoadedActivities, fetchActivities } = useActivityStore(
    useShallow((state) => ({
      activities: state.activities,
      hasLoadedActivities: state.hasLoaded,
      fetchActivities: state.fetchActivities,
    })),
  );
  const currentUserId = useUserDataStore((state) => state.id);
  const userName = useUserDataStore((state) => state.name);

  useEffect(() => {
    // 三个 store 内部已处理异常（失败时同样置位 hasLoaded，页面落到空态而不是一直转圈），
    // 与 /projects、/tasks 的现有行为一致，这里不再重复提示
    fetchProjects();
    fetchCards();
    fetchActivities();
  }, [fetchProjects, fetchCards, fetchActivities]);

  // 我的未完成任务（含独立任务）：统计与列表共用同一份过滤结果
  const myOpenTasks = cards.filter((card) => isMyOpenTask(card, currentUserId));
  const inProgressCount = myOpenTasks.filter(
    (card) => card.state === TaskState.InProgress,
  ).length;
  const overdueCount = myOpenTasks.filter((card) => isOverdue(card)).length;

  // 动态只展示别人的操作（自己的工作不需要在首页提醒自己）；
  // 接口多返回一些（ACTIVITY_FETCH_LIMIT），过滤后再截断，避免我活跃时动态区被自己刷空
  const feedActivities = activities
    .filter((activity) => activity.user.id !== currentUserId)
    .slice(0, ACTIVITY_LIMIT);

  // 首次加载未结束前显示骨架屏（含首帧）；已加载过则保留旧数据静默刷新
  if (!hasLoaded || !hasLoadedCards || !hasLoadedActivities) {
    return <HomeSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 sm:p-8">
      <Greeting name={userName} assigneeId={currentUserId || undefined} />

      <StatsRow
        projectCount={projects.length}
        openTaskCount={myOpenTasks.length}
        inProgressCount={inProgressCount}
        overdueCount={overdueCount}
      />

      <MyTasksSection
        tasks={sortMyTasks(myOpenTasks).slice(0, MY_TASK_LIMIT)}
        total={myOpenTasks.length}
        projects={projects}
      />

      <RecentProjectsSection
        projects={projects.slice(0, RECENT_PROJECT_LIMIT)}
      />

      <ActivityFeedSection activities={feedActivities} />
    </div>
  );
}
