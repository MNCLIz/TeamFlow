"use client";

import { useCallback, useSyncExternalStore } from "react";

// 响应式媒体查询：服务端渲染时用 serverValue 占位，避免 hydration 不一致
export function useMediaQuery(query: string, serverValue = false) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}
