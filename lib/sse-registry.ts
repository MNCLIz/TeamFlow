/**
 * SSE 连接的跨 bundle 注册表。
 *
 * 背景：自定义服务器（`server.ts`）与 Next 的 Route Handler 是**两份独立的 bundle**，
 * `lib/sse.ts` 里的模块级 Map 不会共享。协作服务器在快照落库后要通知 SSE 连接，
 * 如果各自持有不同的 Map，广播会静默失败（不报错、无日志），排查成本极高。
 *
 * 因此把注册表挂到 `globalThis` 上：同一 Node 进程内的所有 bundle 拿到同一份。
 */

/**
 * 只需要 `enqueue`：ReadableStreamDefaultController 与它结构兼容，
 * 因此 API Route 不需要为了类型转换改任何调用代码。
 */
export interface SseController {
  enqueue(chunk?: string): void;
  close?(): void;
}

type ControllerSet = Set<SseController>;

export interface SseRegistry {
  readonly size: number;
  get(key: string): ControllerSet | undefined;
  set(key: string, value: ControllerSet): unknown;
  delete(key: string): unknown;
}

class MapSseRegistry extends Map<string, ControllerSet> implements SseRegistry {}

const REGISTRY_KEY = "__dsh_sse_registry__";

interface GlobalWithRegistry {
  [REGISTRY_KEY]?: SseRegistry;
}

/**
 * 取得（必要时创建）全局注册表。server.ts 在启动时调用一次，
 * `lib/sse.ts` 内部也调用，两边拿到的是同一个对象。
 */
export function sseRegistry(): SseRegistry {
  const holder = globalThis as unknown as GlobalWithRegistry;
  if (!holder[REGISTRY_KEY]) {
    holder[REGISTRY_KEY] = new MapSseRegistry();
  }
  return holder[REGISTRY_KEY];
}

/** 启动时显式初始化一次，便于日志确认注册表已经就位 */
export function openSseRegistry(): SseRegistry {
  const registry = sseRegistry();
  console.log(`[collab] SSE 注册表已就绪（频道数 ${registry.size}）`);
  return registry;
}
