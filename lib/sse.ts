import { sseRegistry, type SseController } from "@/lib/sse-registry";

/**
 * SSE 连接管理与广播。
 *
 * 注册表放在 `lib/sse-registry.ts` 的 globalThis 单例里，而不是本模块的模块级 Map：
 * 自定义服务器与 Route Handler 是两份 bundle，模块级状态不共享，协作服务侧的广播会静默丢失。
 */

export function addConnection(projectId: string, controller: SseController) {
  const registry = sseRegistry();
  let set = registry.get(projectId);
  if (!set) {
    set = new Set<SseController>();
    registry.set(projectId, set);
  }
  set.add(controller);
}

export function removeConnection(projectId: string, controller: SseController) {
  const registry = sseRegistry();
  const set = registry.get(projectId);
  if (set) {
    set.delete(controller);
    if (set.size === 0) {
      registry.delete(projectId);
    }
  }
}

export function broadcast(projectId: string, event: string, data: unknown) {
  const set = sseRegistry().get(projectId);
  if (!set) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of set) {
    try {
      controller.enqueue(message);
    } catch {
      set.delete(controller);
    }
  }
}
