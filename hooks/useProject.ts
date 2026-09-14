"use client";

import { useEffect } from "react";
import { useBoardStore } from "@/store/boardStore";

export function useProject(projectId: string) {
  const { columns, isLoading, setColumns } = useBoardStore();

  useEffect(() => {
    async function fetchBoard() {
      useBoardStore.setState({ isLoading: true });
      try {
        const res = await fetch(`/api/projects/${projectId}/columns`);
        const data = await res.json();
        if (data.success) {
          setColumns(data.data);
        }
      } finally {
        useBoardStore.setState({ isLoading: false });
      }
    }
    fetchBoard();
  }, [projectId, setColumns]);

  return { columns, isLoading };
}
