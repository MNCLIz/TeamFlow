"use client";

import { useEffect } from "react";
import { useBoardStore } from "@/store/boardStore";

export function useProject(projectId: string) {
  const { columns, isLoading, fetchColumns } = useBoardStore();

  useEffect(() => {
    fetchColumns(projectId);
  }, [projectId, fetchColumns]);

  return { columns, isLoading };
}
