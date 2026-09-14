"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseRealtimeOptions {
  projectId: string;
  onEvent: (event: MessageEvent) => void;
}

export function useRealtime({ projectId, onEvent }: UseRealtimeOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/projects/${projectId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      retryCountRef.current = 0;
      onEvent(event);
    };

    es.onerror = () => {
      es.close();
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        setTimeout(connect, delay);
      }
    };
  }, [projectId, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);
}
