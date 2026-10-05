"use client";

import { useCallback, useSyncExternalStore } from "react";

// 页面是否处于前台标签页：后台标签页不该把新评论当作"已读"（否则未读提示会被吞掉）
export function useDocumentVisible() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    document.addEventListener("visibilitychange", onStoreChange);
    return () =>
      document.removeEventListener("visibilitychange", onStoreChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "visible",
    () => true
  );
}
