"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MdEditor,
  type MdEditorHandle,
  type MdEditorCollabConfig,
  type YCursorOpts,
} from "@/components/shared/MdEditor";
import { DocPresenceBar } from "@/components/shared/DocPresenceBar";
import { useCollabDoc } from "@/hooks/useCollabDoc";
import { collabColorOf } from "@/lib/collab/presence-color";
import { useUserDataStore } from "@/store/userDataStore";

/**
 * 协作版 Markdown 编辑器：把 `MdEditor` 绑定到一个 Yjs 文档上。
 *
 * 与 `MdEditor` 的分工：`MdEditor` 负责编辑器本身（含协作/本地两种模式），
 * 这里负责「文档生命周期 + 播种 + 骨架屏」，业务页面只跟这个组件打交道。
 */

// 播种重试：MdEditor 内部 useEditor 的就绪时机不受外层控制，用「短间隔轮询」等它，
// 总预算约 6s（40 × 150ms）——超出就放弃，避免文档一直空白时无限重试
const SEED_RETRY_MS = 150;
const SEED_MAX_ATTEMPTS = 40;

interface CollabMdEditorProps {
  /** 项目描述传 `project-<id>`，卡片描述传 `card-<id>` */
  docName: string;
  /** 首次打开时用于播种的既有描述（仅当文档为空时应用） */
  seedMarkdown: string;
  readOnly?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
  /** 供导入/导出使用 */
  ref?: React.Ref<MdEditorHandle>;
}

export function CollabMdEditor({
  docName,
  seedMarkdown,
  readOnly = false,
  placeholder,
  wrapperClassName,
  ref,
}: CollabMdEditorProps) {
  const userId = useUserDataStore((state) => state.id);
  const userName = useUserDataStore((state) => state.name);
  const userImage = useUserDataStore((state) => state.image);

  // 编辑器正文（由 onMarkdownChange 回填，带 200ms 防抖，只能当兜底值）
  const markdownRef = useRef<string | null>(null);
  const internalRef = useRef<MdEditorHandle>(null);

  // 投影取值器：**直接问编辑器要当前正文**，而不是读 markdownRef。
  //
  // 为什么必须这样（阶段 4 实测踩到）：`markdownUpdated` 有 200ms 防抖，`markdownRef`
  // 会短暂落后于 Y.Doc；而投影上报是「文档一更新就防抖 800ms 上报」，于是完全可能出现
  // 「上报里的 state vector 已经包含对方的更新，但 markdown 还是旧的一版」，服务端据此
  // 写回 `description` 就会丢掉另一个人的编辑。`exportMarkdown()` 走的是编辑器的
  // `getMarkdown()` 宏，取的是当前视图的真实内容，不会落后。
  const getMarkdown = useCallback(() => {
    const live = internalRef.current?.exportMarkdown();
    if (live && live.trim()) return live;
    // 编辑器还没就绪 / 正文为空：退回最近一次回填值，再退回播种内容
    return markdownRef.current ?? seedMarkdown;
  }, [seedMarkdown]);

  const collabDoc = useCollabDoc({
    docName,
    getMarkdown,
    user: { id: userId, name: userName || null, image: userImage || null },
  });

  // 是否已「处理过」播种（真播了 / 文档本来非空 / 无须播种）。注意不能等同「尝试过」：
  // MdEditor 内部的 useEditor 在 effect 首次触发时往往还是 loading，必须等它就绪再试。
  const seededRef = useRef(false);
  // 编辑器就绪前的重试计数（每次变化都会重新跑播种 effect）
  const [seedAttempt, setSeedAttempt] = useState(0);
  // 上一次「没东西可播」时看到的 seedMarkdown：只有当它变化了才值得再试一次，
  // 否则 seedMarkdown 为空会让 effect 反复空转
  const skippedSeedRef = useRef<string | null>(null);

  // 播种：文档为空时把既有的 description 写进去（写进 Y.Doc 后会同步给所有端）
  useEffect(() => {
    if (seededRef.current) return;
    if (!collabDoc.loaded || !collabDoc.synced) return;
    // 本地 IndexedDB 必须先读完：里面的离线改动也算「文档已有内容」，
    // 早于它播种会在重连合并后出现重复正文
    if (!collabDoc.localReady) return;
    if (collabDoc.readOnly) return;
    if (!seedMarkdown) {
      // 还没有内容可播。**不能**就此标记「已处理」：description 可能比文档晚到
      // （项目列表 → 详情页的客户端跳转、SSE 投影更新等），一旦锁死，
      // 文档就永远是空的，而服务端其实存着描述。
      // 记下这次看到的值，等它变化（有内容了）再重试。
      skippedSeedRef.current = seedMarkdown;
      return;
    }
    if (skippedSeedRef.current === seedMarkdown) return;
    const result = internalRef.current?.applySeed(seedMarkdown) ?? "not-ready";
    if (result === "not-ready") {
      // 编辑器还没就绪：稍后重试（最多 SEED_MAX_ATTEMPTS 次，约 6s）
      if (seedAttempt >= SEED_MAX_ATTEMPTS) {
        seededRef.current = true;
        return;
      }
      const timer = window.setTimeout(
        () => setSeedAttempt((attempt) => attempt + 1),
        SEED_RETRY_MS,
      );
      return () => window.clearTimeout(timer);
    }
    seededRef.current = true;
    if (result === "applied") {
      console.log("[collab] 已用既有描述播种文档", docName);
    }
  }, [
    collabDoc.loaded,
    collabDoc.synced,
    collabDoc.localReady,
    collabDoc.readOnly,
    seedMarkdown,
    docName,
    seedAttempt,
  ]);

  // 切换文档时允许重新播种
  useEffect(() => {
    seededRef.current = false;
    markdownRef.current = null;
  }, [docName]);

  // 远端光标：默认的 cursorBuilder 样式偏简陋（细线 + 黑底名字条），
  // 这里用 awareness 里的 user.color 上色，与在线头像条保持一致
  const yCursorOpts = useMemo<YCursorOpts>(
    () => ({
      cursorBuilder: (cursorUser, clientId) => {
        const color = cursorUser.color ?? collabColorOf(cursorUser.id ?? String(clientId));
        // 结构就是 y-prosemirror 默认的结构（外层 = 插入线，内层 = 名字条），
        // 只是把颜色换成 awareness 里的 user.color
        const cursor = document.createElement("span");
        cursor.classList.add("ProseMirror-yjs-cursor");
        cursor.setAttribute("style", `border-color: ${color}`);
        const label = document.createElement("div");
        label.setAttribute("style", `background-color: ${color}`);
        label.setAttribute("data-slot", "collab-remote-cursor-label");
        // 名字不放进 DOM 文本节点：`innerText` 会把文本节点的内容算作正文
        // （aria-hidden / contenteditable=false 都不影响 innerText），
        // 那样 editor.innerText、导出、测试断言都会多出「某某」。
        // 改用 ::after 的 content 绘制，纯视觉、不进文本树。
        label.setAttribute("data-name", cursorUser.name ?? "未命名");
        cursor.appendChild(label);
        return cursor;
      },
    }),
    [],
  );

  if (!collabDoc.loaded || !collabDoc.synced) {
    return <CollabEditorSkeleton readOnly={readOnly} status={collabDoc.status} />;
  }

  const collabConfig: MdEditorCollabConfig = {
    ydoc: collabDoc.ydoc,
    awareness: collabDoc.awareness,
    yCursorOpts,
  };

  return (
    <div data-slot="collab-editor" data-doc={docName}>
      <MdEditor
        ref={mergeRefs(ref, internalRef)}
        id={docName}
        collab={collabConfig}
        readOnly={readOnly || collabDoc.readOnly}
        placeholder={placeholder}
        wrapperClassName={wrapperClassName}
        onMarkdownChange={(markdown) => {
          markdownRef.current = markdown;
        }}
      />
      <DocPresenceBar
        peers={collabDoc.peers}
        offline={collabDoc.offline}
        status={collabDoc.status}
      />
    </div>
  );
}

/** 同时支撑「调用方传 ref」与「组件内部要用 ref」 */
function mergeRefs<T>(
  external: React.Ref<T> | undefined,
  internal: React.RefObject<T | null>,
): React.Ref<T> {
  return (value: T | null) => {
    internal.current = value;
    if (typeof external === "function") external(value);
    else if (external) (external as React.RefObject<T | null>).current = value;
  };
}

/**
 * 等待首屏同步时的占位。用中性灰阶（与 ListSkeleton / HomeSkeleton 一致），
 * 只保留描述区该有的几行高度，避免切换时页面跳动。
 */
function CollabEditorSkeleton({
  readOnly,
  status,
}: {
  readOnly: boolean;
  status: string | null;
}) {
  return (
    <div
      className="space-y-2 py-1"
      role="status"
      aria-live="polite"
      data-slot="collab-editor-skeleton"
      data-status={status ?? "connecting"}
    >
      <div className="h-4 w-2/5 animate-pulse rounded bg-muted/60" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted/60" />
      <span className="sr-only">
        {readOnly ? "正在同步描述…" : "正在连接协作编辑…"}
      </span>
    </div>
  );
}
