/**
 * 投影上报（客户端 → 服务端）。
 *
 * 为什么由客户端上报 Markdown，而不是服务端从 Y.Doc 自己序列化：
 * 服务端要序列化就必须重建一份与 Milkdown commonmark preset 完全一致的 ProseMirror schema
 * （该 preset 没有 schema 子路径导出），一旦两边 schema 有细微差异就会静默产出错误的 Markdown。
 * 而 Y.Doc 本身才是权威数据，`markdown` 只是给列表页/导出/搜索用的投影，所以由真正持有
 * schema 的客户端上报是更稳妥的选择。
 *
 * 上报里带 state vector：服务端据此能判断「这份 Markdown 是否覆盖了当前文档状态」，
 * 从而避免把过期投影写回数据库。
 */

import * as decoding from "lib0/decoding";

export const REPORT_VERSION = 1;
export interface ProjectionReport {
  version: number;
  documentName: string;
  /** base64 编码的 Y.encodeStateVector(doc) */
  stateVector: string;
  markdown: string;
}

export function buildProjectionReport(params: {
  documentName: string;
  stateVector: Uint8Array;
  markdown: string;
}): string {
  const report: ProjectionReport = {
    version: REPORT_VERSION,
    documentName: params.documentName,
    stateVector: bytesToBase64(params.stateVector),
    markdown: params.markdown,
  };
  return JSON.stringify(report);
}

/** 宽松解析：任何不符合约定的载荷都返回 null（调用方静默忽略） */
export function parseProjectionReport(payload: string): ProjectionReport | null {
  try {
    const parsed = JSON.parse(payload) as Partial<ProjectionReport>;
    if (parsed.version !== REPORT_VERSION) return null;
    if (typeof parsed.documentName !== "string" || !parsed.documentName) return null;
    if (typeof parsed.stateVector !== "string") return null;
    if (typeof parsed.markdown !== "string") return null;
    return {
      version: parsed.version,
      documentName: parsed.documentName,
      stateVector: parsed.stateVector,
      markdown: parsed.markdown,
    };
  } catch {
    return null;
  }
}

export function decodeStateVector(base64: string): Uint8Array | null {
  try {
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

/**
 * 把状态向量字节解码成 Map<clientId, clock>。
 *
 * 手写解码而不是用 `Y.decodeStateVector`：lib0 没有这个 helper，而引入整个 yjs 只为读一个
 * Map 不划算。状态向量的编码是 lib0 的 varUint 序列：`长度 | (clientId, clock) * 长度`。
 */
export function stateVectorToMap(bytes: Uint8Array): Map<number, number> | null {
  try {
    const decoder = decoding.createDecoder(bytes);
    const count = decoding.readVarUint(decoder);
    const map = new Map<number, number>();
    for (let index = 0; index < count; index++) {
      const client = decoding.readVarUint(decoder);
      map.set(client, decoding.readVarUint(decoder));
    }
    return map;
  } catch {
    return null;
  }
}

/** `a ⊇ b`：对 b 的每个 client，a 里的 clock 都不小于它 */
export function stateVectorCovers(
  a: Map<number, number>,
  b: Map<number, number>,
): boolean {
  for (const [client, clock] of b) {
    if ((a.get(client) ?? 0) < clock) return false;
  }
  return true;
}

/**
 * 记录某个文档「已接受写回」的投影状态向量，用于「单调不回退」判定。
 *
 * 为什么不用「上报必须覆盖文档当前状态」做新鲜度基准：文档在 `onStoreDocument` 触发的
 * 瞬间可能已经比上报更新（上报先到、文档后到），那样会把**合法**的投影误判为过期丢弃，
 * 于是 `description` 停在旧一版（阶段 4 实测）。改成与「上一次写回的投影」比：
 * 只有明确更旧的上报才丢，否则一律写回 —— 配合客户端定期重报，最终必然收敛到最新。
 */
const ACCEPTED_KEY = "__dsh_collab_accepted_vectors__";

function acceptedVectors(): Map<string, Map<number, number>> {
  const holder = globalThis as unknown as {
    [ACCEPTED_KEY]?: Map<string, Map<number, number>>;
  };
  if (!holder[ACCEPTED_KEY]) holder[ACCEPTED_KEY] = new Map();
  return holder[ACCEPTED_KEY];
}

export function rememberAcceptedVector(
  documentName: string,
  vector: Map<number, number>,
): void {
  acceptedVectors().set(documentName, vector);
}

export function forgetAcceptedVector(documentName: string): void {
  acceptedVectors().delete(documentName);
}

/**
 * 这次上报是否不该写回（相对上一次已写回的投影是「更旧」的）。
 *
 * 判定原则是**保守**：只要两者不可比（任一方缺少对方的 client），就认为可写 ——
 * 宁可多写一次也不要把合法投影挡掉；真正过期的情况会在下一次心跳上报时被覆盖。
 */
export function isStaleProjection(
  documentName: string,
  next: Map<number, number>,
): boolean {
  const previous = acceptedVectors().get(documentName);
  if (!previous) return false;
  // next 覆盖 previous → 更新，写
  if (stateVectorCovers(next, previous)) return false;
  // previous 覆盖 next → next 更旧，丢
  if (stateVectorCovers(previous, next)) return true;
  // 互不可比（各自缺对方 client）：无法判断，按可写处理
  return false;
}

// ---------------------------------------------------------------- 最近一次上报的缓存

const KEY = "__dsh_collab_projection_reports__";

function cache(): Map<string, ProjectionReport> {
  const holder = globalThis as unknown as { [KEY]?: Map<string, ProjectionReport> };
  if (!holder[KEY]) holder[KEY] = new Map();
  return holder[KEY];
}

export function rememberReport(report: ProjectionReport): void {
  cache().set(report.documentName, report);
}

export function recallReport(documentName: string): ProjectionReport | null {
  return cache().get(documentName) ?? null;
}

export function forgetReport(documentName: string): void {
  cache().delete(documentName);
}

// ---------------------------------------------------------------- base64（Node 与浏览器都需要）

/**
 * 客户端在浏览器里跑（`btoa`），服务端在 Node 里跑（`Buffer`）；
 * 这里用一个最小的实现同时兼容两边，避免为了编码引入额外依赖。
 */
function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export { bytesToBase64, base64ToBytes };
