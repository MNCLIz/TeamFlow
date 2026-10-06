"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { getDocStateAPI } from "@/lib/api/DocsAPI";
import { buildProjectionReport, base64ToBytes } from "@/lib/collab/projection";
import { collabColorOf } from "@/lib/collab/presence-color";

/**
 * 协作文档的连接与生命周期。
 *
 * 职责边界：
 * - 这里只管 Y.Doc / Awareness / WebSocket provider 与「投影上报」
 * - 编辑器怎么用这个 Y.Doc 是 `CollabMdEditor` 的事（Milkdown 的 collab 插件）
 *
 * 客户端上报 Markdown 的原因见 lib/collab/projection.ts。
 */

/**
 * 上报防抖：服务端 onStoreDocument 有 ~2s 防抖，这里更短即可保证「上报先于落库」。
 */
const REPORT_DEBOUNCE_MS = 800;

/**
 * 连接期间定期重报投影的间隔。
 *
 * 只靠「变化后防抖上报」不够：服务端可能在某次上报**之前**就已经积累了别人的更新，
 * 于是那次上报的 state vector 落后于文档、被判为过期而跳过写回（`documents.markdown` /
 * `projects.description` 停在旧一版，实测复现）。定期重报保证服务端总能拿到一份
 * 「覆盖当前文档状态」的投影；载荷很小（几百字节的 stateless 消息），代价可以接受。
 */
const REPORT_HEARTBEAT_MS = 2500;

/** 协作时在场的一个用户（来自 awareness） */
export interface CollabPeer {
  clientId: number;
  userId: string;
  name: string;
  image: string | null;
  color: string;
  /** 是否是本端（用于「你」的标注） */
  isSelf: boolean;
}

export interface CollabDocState {
  ydoc: Y.Doc;
  awareness: Awareness;
  /** 是否已收到服务端的初始同步（true 之后编辑器才能挂载） */
  synced: boolean;
  /** 服务端 / 接口判定的只读 */
  readOnly: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER" | null;
  /** WS 连接状态，用于「已连接 / 重连中」提示 */
  status: WebSocketStatus | null;
  /** 首次打开时用于播种的既有描述（仅当文档为空时由编辑器应用） */
  seedMarkdown: string;
  /** 初始状态是否已取回（失败也算取回，避免一直卡在骨架屏） */
  loaded: boolean;
  /**
   * 本地 IndexedDB 是否已加载完。
   * 播种必须等它：否则离线时本地缓存还没读出来就判定「文档为空」，播种出的内容会和缓存副本重复。
   */
  localReady: boolean;
  /** 当前在线的协作者（含自己），按加入顺序 */
  peers: CollabPeer[];
  /**
   * 是否处于离线（WS 已断开）。此时编辑照常进行并写入本地 IndexedDB，
   * 重连后由 Yjs 自动合并（服务端只做 CRDT 合并，不需要冲突处理）。
   */
  offline: boolean;
}

interface UseCollabDocParams {
  docName: string;
  /** 取当前编辑器正文（Markdown）；编辑器未就绪时返回 null，跳过本次上报 */
  getMarkdown: () => string | null;
  /** 当前用户信息，用于 awareness（远端光标/在线头像） */
  user: { id: string; name: string | null; image: string | null };
}

export function useCollabDoc({
  docName,
  getMarkdown,
  user,
}: UseCollabDocParams): CollabDocState {
  // Y.Doc 与 Awareness 不属于 React 渲染状态，跨 render 稳定即可
  const ydoc = useMemo(() => new Y.Doc(), []);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);

  const [synced, setSynced] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [role, setRole] = useState<CollabDocState["role"]>(null);
  const [status, setStatus] = useState<WebSocketStatus | null>(null);
  const [seedMarkdown, setSeedMarkdown] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [peers, setPeers] = useState<CollabPeer[]>([]);

  // getMarkdown 每次 render 可能变化，用 ref 转发避免重建连接
  const getMarkdownRef = useRef(getMarkdown);
  useEffect(() => {
    getMarkdownRef.current = getMarkdown;
  }, [getMarkdown]);

  // 「发送投影」的实现由连接 effect 写入，供 synced 回调与 doc 的 update 监听器调用
  const reportRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let provider: HocuspocusProvider | null = null;

    // 用 ref 持有「发送投影」的实现：它既要能在 synced 后立刻调用，
    // 也要能被 doc 的 update 监听器调用，而 provider 是异步创建的
    const report = () => {
      if (cancelled || !provider) return;
      const markdown = getMarkdownRef.current();
      if (markdown === null) return;
      try {
        provider.sendStateless(
          buildProjectionReport({
            documentName: docName,
            stateVector: Y.encodeStateVector(ydoc),
            markdown,
          }),
        );
      } catch {
        // 连接已断开：下一次 update 会再试
      }
    };
    reportRef.current = report;

    const connect = async () => {
      // 0) 先把本地 IndexedDB 里的副本读出来（离线编辑靠它；也让首屏更快）
      //    必须在「播种」之前完成，否则会把已有本地内容当成空文档再播一次种
      try {
        const persistence = new IndexeddbPersistence(docName, ydoc);
        await persistence.whenSynced;
      } catch (error) {
        // 隐私模式/存储被禁用等：本地缓存不可用不影响在线协作
        console.warn("[collab] 本地缓存不可用，已跳过:", error);
      }
      if (cancelled) return;
      setLocalReady(true);

      // 1) 再取元信息（只读判定 + 播种内容 + 已落库快照）
      let initialState: string | null = null;
      let seed = "";
      try {
        const state = await getDocStateAPI(docName);
        if (cancelled) return;
        initialState = state.state;
        seed = state.seedMarkdown ?? "";
        setReadOnly(state.readOnly);
        setRole(state.role);
        setSeedMarkdown(seed);
      } catch (error) {
        // 拉不到元信息也不能卡在骨架屏：按只读处理，避免误编辑
        console.error("[collab] 读取文档初始状态失败:", error);
        if (cancelled) return;
        setReadOnly(true);
      } finally {
        if (!cancelled) setLoaded(true);
      }

      // 2) 应用已落库的 Yjs 快照（正常情况下内容由 WS 同步补齐，
      //    带上它可以让「刚打开页面」少一次往返）
      if (initialState) {
        try {
          Y.applyUpdate(ydoc, base64ToBytes(initialState));
        } catch (error) {
          console.error("[collab] 应用初始快照失败:", error);
        }
      }
      if (cancelled) return;

      // 3) 建立 WS 连接
      provider = new HocuspocusProvider({
        url: collabWsUrl(docName),
        name: docName,
        document: ydoc,
        awareness,
        onSynced: () => {
          if (cancelled) return;
          setSynced(true);
          // 立刻报一次：保证服务端第一次落库时就有可用的投影
          report();
        },
        onStatus: ({ status: next }) => {
          if (!cancelled) setStatus(next);
        },
      });
    };

    void connect();

    return () => {
      cancelled = true;
      reportRef.current = null;
      // 只用 provider.destroy() 收尾：它自己会 removeAwarenessStates + awareness.destroy()。
      // **不要**在这里再调 `awareness.setLocalState(null)` 或 `ydoc.destroy()`：
      //   - provider.destroy() 已经把 awareness 永久销毁，之后任何 setLocalState* 都是空操作；
      //     StrictMode 下 effect 会「挂载→清理→再挂载」，第二次挂载拿到的是一个死掉的 awareness，
      //     表现就是在线用户永远是 0 人、远端光标永远不出现（阶段 4 实测踩到）
      //   - awareness 与 ydoc 由 useMemo 持有，跨 effect 重跑稳定，不该在这里销毁
      //
      // 但必须把 provider.destroy() 期间派发的 awareness `change` 挡掉，否则会抛
      // `MilkdownError: Context "editorState" not found`：destroy() 内部的
      // removeAwarenessStates() 会同步派发 change，而 y-prosemirror 的 yCursorPlugin
      // 挂在 change 上做 `setMeta(view, …)` → `view.dispatch()`。此时编辑器（子组件）的
      // 清理已经跑完，`editorStateCtx` 被移除，这个迟到的事务就找不到上下文了。
      // 挡的只是「本端正在拆连接」这一瞬间：在线用户条 / 远端光标在重新挂载后照常工作。
      const originalEmit = awareness.emit;
      awareness.emit = (name, args) =>
        name === "change" ? undefined : originalEmit.call(awareness, name, args);
      try {
        provider?.destroy();
      } finally {
        awareness.emit = originalEmit;
      }
    };
  }, [docName, ydoc, awareness]);

  // 投影上报：文档每次变化后防抖上报一次（包含远端改动 —— 内容变了投影就得跟着变），
  // 并在连接期间定期重报（见 REPORT_HEARTBEAT_MS 的说明）。
  useEffect(() => {
    let timer: number | null = null;
    const handleUpdate = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        reportRef.current?.();
      }, REPORT_DEBOUNCE_MS);
    };
    ydoc.on("update", handleUpdate);
    const heartbeat = window.setInterval(() => {
      // 防抖已经排上了就不重复发
      if (timer === null) reportRef.current?.();
    }, REPORT_HEARTBEAT_MS);
    return () => {
      ydoc.off("update", handleUpdate);
      window.clearInterval(heartbeat);
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
        // 断开前已经来不及防抖了，直接发（失败也无所谓：服务端下一次落库还会收到新投影）
        reportRef.current?.();
      }
    };
  }, [ydoc]);

  // awareness：把用户信息广播出去（远端光标与在线头像用）
  useEffect(() => {
    awareness.setLocalStateField("user", {
      id: user.id,
      name: user.name ?? "未命名",
      image: user.image,
      color: collabColorOf(user.id),
    });
  }, [awareness, user.id, user.name, user.image]);

  // 开发期调试句柄（见 exposeCollabDebug）：E2E 用它读 awareness 断言远端光标与在线用户
  useEffect(() => {
    exposeCollabDebug(ydoc, awareness, docName);
  }, [ydoc, awareness, docName]);

  // 在线协作者：awareness 的 states 里每个 clientId 一份，含自己
  useEffect(() => {
    const collect = () => {
      const next: CollabPeer[] = [];
      awareness.getStates().forEach((state, clientId) => {
        const peer = state.user as
          | { id?: string; name?: string; image?: string | null; color?: string }
          | undefined;
        if (!peer?.id) return;
        next.push({
          clientId,
          userId: peer.id,
          name: peer.name ?? "未命名",
          image: peer.image ?? null,
          color: peer.color ?? collabColorOf(peer.id),
          isSelf: clientId === awareness.clientID,
        });
      });
      // 自己排最前，其余按 clientId 稳定排序（避免头像顺序抖动）
      next.sort((a, b) =>
        a.isSelf === b.isSelf ? a.clientId - b.clientId : a.isSelf ? -1 : 1,
      );
      setPeers(next);
    };
    collect();
    awareness.on("change", collect);
    return () => awareness.off("change", collect);
  }, [awareness]);

  return {
    ydoc,
    awareness,
    synced,
    readOnly,
    role,
    status,
    seedMarkdown,
    loaded,
    localReady,
    peers,
    offline: status === "disconnected",
  };
}

/**
 * 开发期把 Y.Doc / Awareness 挂到 window 上。
 *
 * 远端光标、presence 这类能力没有可直接断言的 DOM（光标是 Decoration，
 * 名字条只在有选区时才渲染），E2E 需要一个稳定的观察点。生产构建里这段会被
 * `process.env.NODE_ENV` 静态判掉、不进产物。
 */
export const COLLAB_DEBUG_KEY = "__dshCollab";

function exposeCollabDebug(ydoc: Y.Doc, awareness: Awareness, docName: string) {
  if (process.env.NODE_ENV === "production") return;
  (window as unknown as Record<string, unknown>)[COLLAB_DEBUG_KEY] = {
    docName,
    ydoc,
    awareness,
  };
}

/** WS 地址：与页面同源，握手会带上会话 Cookie（鉴权在服务端完成） */
function collabWsUrl(docName: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/collab/${docName}`;
}

export type CollabDocRef = RefObject<(() => void) | null>;
