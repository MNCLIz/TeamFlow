"use client";

import { useEffect, useRef } from "react";

export interface RealtimeEventMap {
  "card:created"?: (data: unknown) => void;
  "card:updated"?: (data: unknown) => void;
  "card:moved"?: (data: unknown) => void;
  "card:deleted"?: (data: unknown) => void;
  "member:added"?: (data: unknown) => void;
  "member:removed"?: (data: unknown) => void;
  connected?: (data: unknown) => void;
}

interface UseRealtimeOptions {
  projectId: string;
  events: RealtimeEventMap;
}

export function useRealtime({ projectId, events }: UseRealtimeOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  // 重试计数
  const retryCountRef = useRef(0);
  // 最大重试次数
  const maxRetries = 5;
  // 缓存 events
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    let es: EventSource | null = null;

    const connect = () => {
      if (es) {
        es.close();
      }

      const url = `/api/projects/${projectId}/events`;
      console.log("[SSE] Connecting to:", url);
      es = new EventSource(url);
      eventSourceRef.current = es;

      // 连接成功时重置重试计数
      es.onopen = () => {
        console.log("[SSE] Connection opened");
        retryCountRef.current = 0;
      };

      const eventNames = Object.keys(eventsRef.current) as Array<
        keyof RealtimeEventMap
      >;

      for (const eventName of eventNames) {
        es.addEventListener(eventName, (e: MessageEvent) => {
          retryCountRef.current = 0;
          try {
            const data = JSON.parse(e.data);
            eventsRef.current[eventName]?.(data);
            console.log(`[SSE] Received event: ${eventName}`, data);
          } catch {
            console.warn("[SSE] Failed to parse event data:", e.data);
          }
        });
      }

      es.onerror = (e) => {
        console.error("[SSE] Connection error, readyState:", es?.readyState, e);
        es?.close();
        es = null;
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = Math.min(
            1000 * Math.pow(2, retryCountRef.current),
            30000,
          );
          console.log(`[SSE] Retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
          setTimeout(connect, delay);
        } else {
          console.error("[SSE] Max retries reached, giving up");
        }
      };
    };

    connect();

    return () => {
      es?.close();
      eventSourceRef.current = null;
    };
  }, [projectId]);
}
