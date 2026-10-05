"use client";

import { useEffect, useState } from "react";
import { getProjectMembersAPI } from "@/lib/api/ProjectsAPI";
import { useProjectStore } from "@/store/projectStore";
import type { MemberType } from "@/types/project";

// 项目成员来源：优先用 projectStore（项目页/任务页已种入，添加成员后即时可见），
// store 里没有该项目时（例如从"全部任务页"打开卡片抽屉）回退到接口拉取。
// projectId 为 null（独立任务）时没有成员可拉，直接返回空。
// enabled=false 时完全不请求（评论列表里每条评论都可能调用本 Hook，只有真正要用面板时才需要成员）
export function useProjectMembers(
  projectId: string | null,
  enabled = true
): MemberType[] {
  const storeMembers = useProjectStore((state) =>
    state.projects.find((project) => project.id === projectId)?.members
  );
  const [fetched, setFetched] = useState<MemberType[]>([]);

  const hasStoreMembers = (storeMembers?.length ?? 0) > 0;

  useEffect(() => {
    if (!enabled || hasStoreMembers || !projectId) return;

    let cancelled = false;
    getProjectMembersAPI(projectId)
      .then((members) => {
        if (!cancelled) setFetched(members);
      })
      .catch((err) => {
        // 拉取失败只影响 @提及面板，不阻塞评论本身
        console.error("[useProjectMembers] 获取项目成员失败:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, hasStoreMembers, enabled]);

  if (storeMembers?.length) return storeMembers;
  return fetched;
}
