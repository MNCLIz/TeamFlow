"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { useProjectStore } from "@/store/projectStore";
import { useBoardStore } from "@/store/boardStore";
import { useUserDataStore } from "@/store/userDataStore";
import { postCreateStandaloneCardAPI } from "@/lib/api/BoardAPI";
import { TaskState } from "@/types/board";
import { Greeting } from "./home/Greeting";
import { StatsRow } from "./home/StatsRow";
import { MyTasksSection } from "./home/MyTasksSection";
import { RecentProjectsSection } from "./home/RecentProjectsSection";
import { HomeSkeleton } from "./home/HomeSkeleton";
import { isMyOpenTask, isOverdue, sortMyTasks } from "./home/task-order";

// 「我的任务」最多列前 8 条，超出走「查看全部」；最近项目取 4 个（接口已按 updatedAt 倒序）
const MY_TASK_LIMIT = 8;
const RECENT_PROJECT_LIMIT = 4;

/**
 * 首页概览（登录后的工作台）：问候 + 统计 + 我的任务 + 最近项目。
 * 数据完全复用 /projects、/tasks 已有的两个 store（projectStore / boardStore），不新增接口；
 * 汇总口径集中在 app/home/task-order.ts，子组件只负责展示。
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
  const currentUserId = useUserDataStore((state) => state.id);
  const userName = useUserDataStore((state) => state.name);

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // 两个 store 内部已处理异常（失败时同样置位 hasLoaded，页面落到空态而不是一直转圈），
    // 与 /projects、/tasks 的现有行为一致，这里不再重复提示
    fetchProjects();
    fetchCards();
  }, [fetchProjects, fetchCards]);

  const handleCreateTask = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await postCreateStandaloneCardAPI({
        title: "新任务",
        // 直接归属自己，创建后立刻出现在「我的任务」里
        assigneeId: currentUserId || undefined,
      });
      // 独立任务不进看板 columns，重新拉一次扁平列表即可（与 /tasks 的 NewTaskButton 同逻辑）
      await fetchCards();
      toast.success("已创建任务");
    } catch {
      toast.error("创建任务失败");
    } finally {
      setCreating(false);
    }
  };

  // 我的未完成任务（含独立任务）：统计与列表共用同一份过滤结果
  const myOpenTasks = cards.filter((card) => isMyOpenTask(card, currentUserId));
  const inProgressCount = myOpenTasks.filter(
    (card) => card.state === TaskState.InProgress,
  ).length;
  const overdueCount = myOpenTasks.filter((card) => isOverdue(card)).length;

  // 首次加载未结束前显示骨架屏（含首帧）；已加载过则保留旧数据静默刷新
  if (!hasLoaded || !hasLoadedCards) {
    return <HomeSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 sm:p-8">
      <Greeting
        name={userName}
        creating={creating}
        onCreateTask={handleCreateTask}
      />

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
    </div>
  );
}
