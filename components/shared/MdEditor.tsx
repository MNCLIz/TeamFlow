"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  useImperativeHandle,
  type Ref,
} from "react";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { indent } from "@milkdown/kit/plugin/indent";
import { trailing } from "@milkdown/kit/plugin/trailing";
import {
  upload,
  uploadConfig,
  type Uploader,
} from "@milkdown/kit/plugin/upload";
import { getMarkdown, replaceAll } from "@milkdown/kit/utils";
import { collab, collabServiceCtx } from "@milkdown/plugin-collab";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { Fragment, type Node as ProseNode } from "@milkdown/prose/model";
import type { EditorState } from "@milkdown/prose/state";
import { Decoration } from "@milkdown/prose/view";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";
import { toast } from "sonner";
import { postImageAPI } from "@/lib/api/ImageAPI";
import "@/app/projects/[id]/Details/milkdown-scoped.css";

// 保存状态：idle 表示没有正在进行的保存（调用方可据此隐藏提示）
export type SaveState = "idle" | "saving" | "saved";

/**
 * 协作模式配置：绑定一个 Y.Doc 与 Awareness，正文由 Yjs 同步。
 * 传入后本组件会：
 * - 不再使用 `history` 插件（改用 collab 自带的 Yjs undo，两套 history 会互相打架）
 * - 不再执行 `defaultValue` 的 replaceAll（内容来自 Y.Doc，被 prop 覆盖会冲掉远端改动）
 * - 不再走「失焦/卸载保存」这条路径（Yjs 事务本身就是持久化路径）
 */
export interface MdEditorCollabConfig {
  ydoc: Y.Doc;
  awareness: Awareness;
  /**
   * `y-prosemirror` 的 yCursorPlugin 选项（远端光标）。
   * 透传给 `collabServiceCtx.setOptions()`，必须在 `connect()` 之前设置。
   */
  yCursorOpts?: YCursorOpts;
}

/** 远端光标选项（与 y-prosemirror 的 yCursorPlugin 第二参数一致） */
export interface YCursorOpts {
  cursorBuilder?: (user: CollabCursorUser, clientId: number) => HTMLElement;
  selectionBuilder?: (user: CollabCursorUser, clientId: number) => Record<string, string>;
  awarenessStateFilter?: (
    currentClientId: number,
    userClientId: number,
    user: unknown,
  ) => boolean;
}

/** awareness 的 `user` 字段（远端光标要用 color 上色、name 做名字条） */
export interface CollabCursorUser {
  id?: string;
  name?: string;
  color?: string;
  image?: string | null;
}

// 对外暴露的编辑器能力（导入 / 导出用）
export interface MdEditorHandle {
  /** 当前正文的 Markdown；编辑器未就绪时退回最近一次回填的临时值 */
  exportMarkdown: () => string;
  /** 用给定 Markdown 整体替换正文并立即保存；返回是否已成功落库（readOnly 下不做事，返回 false） */
  importMarkdown: (markdown: string) => Promise<boolean>;
  /**
   * 协作模式：把已落库内容播种进空文档（非空文档不做任何事，避免覆盖他人内容）。
   *
   * 返回值区分「没做成」的两种原因，调用方据此决定是否重试 —— 这是必须的：
   * 外层 `CollabMdEditor` 的 effect 触发时，本组件内部的 `useEditor` 很可能还在 loading，
   * 把 not-ready 当成终态会让文档永远保持空白（阶段 2 实测踩到过）。
   */
  applySeed: (markdown: string) => SeedResult;
}

export type SeedResult =
  /** 已写入 Y.Doc（会同步给所有人） */
  | "applied"
  /** 编辑器尚未就绪：调用方应稍后重试 */
  | "not-ready"
  /** 文档已有内容（他人写的或快照恢复的）：不覆盖，且不必重试 */
  | "not-empty"
  /** 只读或没有可播种内容：不做事，也不必重试 */
  | "skipped";

interface MdEditorProps {
  id: string;
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  // 外层容器样式：默认沿用项目详情页的排版，任务详情抽屉里需要去掉缩进/外边距
  wrapperClassName?: string;
  // 保存状态回调（可选）：项目详情页用它渲染「保存中/已保存」提示
  onSaveStateChange?: (state: SaveState) => void;
  // 协作模式（可选）：绑定 Y.Doc 后正文走 Yjs 同步，保存路径整体旁路
  collab?: MdEditorCollabConfig;
  // 协作模式下把最新正文回报给调用方（用于向服务端上报 Markdown 投影）
  onMarkdownChange?: (markdown: string) => void;
  // React 19：ref 作为普通 prop 透传到内层（只有 MilkdownProvider 内部才拿得到编辑器实例）
  ref?: Ref<MdEditorHandle>;
  // 本地模式的保存回调；协作模式不调用（Yjs 事务即持久化路径），因此可选
  updateDescription?: (params: {
    id: string;
    name?: string;
    description?: string;
  }) => Promise<void>;
}

function isEmptyMarkdown(markdown: string | null): boolean {
  return markdown && markdown.trim() ? false : true;
}

/**
 * 判断文档是否「没有实际内容」：空文档或只剩一个空段落（`textblock+` 的 schema 下必然有一个空段落）。
 * 不能只看 `content.size === 0` —— 协作插件连接后文档里就已经有一个空段落了，
 * 那样会把它当成「已有内容」而放弃播种（阶段 2 实测踩到过）。
 */
function isDocSemanticallyEmpty(doc: ProseNode): boolean {
  if (doc.childCount === 0) return true;
  if (doc.childCount > 1) return false;
  const only = doc.firstChild;
  return Boolean(only?.isTextblock) && (only?.content.size ?? 0) === 0;
}

// 与 POST /api/upload/image 保持一致，先在本地拦截，避免白传 5MB 才失败
const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// markdownUpdated 的防抖窗口是 200ms：失焦后等它把最新 markdown 回填到 tempRef 再保存
const SAVE_SETTLE_MS = 250;

function isAllowedImage(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

/**
 * 把插入位置收敛成两种合法情况之一：
 * - 文本块内（允许行内节点）→ 直接插入 image 节点
 * - 块级间隙 / 代码块等不允许行内节点的位置 → 退到所在块之后，按块（paragraph 包裹）插入
 * 否则插件的 replaceWith 会抛 Invalid content，占位装饰永远不会被移除
 */
function resolveInsertPos(state: EditorState, pos: number): number {
  const clamped = Math.max(0, Math.min(pos, state.doc.content.size));
  const $pos = state.doc.resolve(clamped);
  // contentMatch.matchType 判断该文本块能否接纳 image（代码块为 text* → 匹配失败）
  const acceptsImage =
    $pos.parent.inlineContent &&
    $pos.parent.type.contentMatch.matchType(state.schema.nodes.image);
  if (acceptsImage) {
    return $pos.pos;
  }
  return $pos.depth === 0 ? $pos.pos : $pos.after($pos.depth);
}

function EditorContent({
  id: id,
  defaultValue = "",
  readOnly = false,
  placeholder = "添加描述…",
  onSaveStateChange,
  collab: collabConfig,
  onMarkdownChange,
  ref,
  updateDescription,
}: MdEditorProps) {
  // 协作模式：正文来自 Y.Doc，保存路径整体旁路（见 MdEditorCollabConfig 注释）
  const isCollab = Boolean(collabConfig);
  // 编辑器只创建一次，用 ref 读取最新的协作配置与回调，避免重建编辑器
  const collabRef = useRef(collabConfig);
  useEffect(() => {
    collabRef.current = collabConfig;
  }, [collabConfig]);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange;
  }, [onMarkdownChange]);

  // 临时保存markdown
  const tempRef = useRef(defaultValue ?? "");
  // 临时保存上次保存的markdown
  const lastSavedRef = useRef(defaultValue ?? "");
  // 是否为空
  const [isEmpty, setIsEmpty] = useState(isEmptyMarkdown(defaultValue ?? ""));
  // 是否聚焦
  const [isFocused, setIsFocused] = useState(false);
  // 容器
  const containerRef = useRef<HTMLDivElement>(null);

  // 保存描述
  const latestOnSave = useRef(updateDescription);
  useEffect(() => {
    latestOnSave.current = updateDescription;
  });
  // 保存状态回调同样用 ref 转发，避免依赖变化导致 saveDescription 重建
  const latestOnSaveState = useRef(onSaveStateChange);
  useEffect(() => {
    latestOnSaveState.current = onSaveStateChange;
  });
  const saveDescription = useCallback(async (): Promise<boolean> => {
    // 协作模式没有「保存」这一步：Yjs 事务即持久化路径
    if (collabRef.current) return true;
    const current = tempRef.current;
    // 没有变化视为已持久化（导入同一份内容时也走这里）
    if (current === lastSavedRef.current) return true;
    latestOnSaveState.current?.("saving");
    // 没有保存回调（纯渲染用法）视为无需保存
    if (!latestOnSave.current) return true;
    try {
      // 只提交一次：latestOnSave 始终指向最新的 updateDescription
      // （原实现在 await updateDescription 之后又用同一份参数调了一次，导致每次保存发两个 PATCH）
      await latestOnSave.current({ id, description: current });
      lastSavedRef.current = current;
      latestOnSaveState.current?.("saved");
      return true;
    } catch {
      latestOnSaveState.current?.("idle");
      toast.error("保存失败，请稍后再试");
      return false;
    }
  }, [id]);

  // 处理markdown更新 — 用 ref 保持最新引用，避免 useEditor factory 重建
  // 保存函数同样用 ref 转发（编辑器只创建一次）
  const saveRef = useRef(saveDescription);
  useEffect(() => {
    saveRef.current = saveDescription;
  });

  // 上传完成后要主动保存一次：listener 的 markdownUpdated 被 debounce 200ms，
  // 不能靠定时器猜时机；这里只打标记，等监听器回填 tempRef 后再触发保存
  const pendingSaveRef = useRef(false);

  const latestSetIsEmpty = useRef(setIsEmpty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    latestSetIsEmpty.current = setIsEmpty;
  });

  // markdown 更新
  const handleMarkdownUpdatedRef = useRef((_ctx: unknown, markdown: string) => {
    tempRef.current = markdown;
    latestSetIsEmpty.current(isEmptyMarkdown(markdown));
    // 协作模式：把最新正文回报给调用方（用于向服务端上报 Markdown 投影）
    onMarkdownChangeRef.current?.(markdown);
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      saveRef.current();
    }
  });

  // 创建编辑器（空 deps → 只创建一次，通过 ref 读取最新回调）
  // readOnly 用 ref 传入，保证编辑器创建时立即生效（member 无法 focus/编辑）
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
  });

  const uploaderRef = useRef<Uploader>(async () => Fragment.empty);

  useEffect(() => {
    // 自定义 uploader：粘贴 / 拖拽的图片文件 → 上传 OSS → 返回待插入节点
    //
    uploaderRef.current = async (files, schema, ctx, insertPos) => {
      // MEMBER 只读：不发起上传，返回空内容让插件正常清掉占位装饰
      if (readOnlyRef.current) return Fragment.empty;

      const images = Array.from(files).filter(isAllowedImage);
      if (!images.length) return Fragment.empty;

      const state = ctx.get(editorViewCtx).state;
      const targetPos = resolveInsertPos(state, insertPos);
      // 落点是否允许行内节点，决定直接插 image 还是包一层 paragraph
      const inline = state.doc.resolve(targetPos).parent.inlineContent;

      const uploaded = await Promise.all(
        images.map(async (file) => {
          if (file.size > MAX_IMAGE_SIZE) {
            toast.error(`「${file.name}」超过 5MB，已跳过`, {
              position: "top-center",
            });
            return null;
          }
          try {
            const { url } = await postImageAPI({ file });
            // 创建一个md编辑器的图片节点
            return schema.nodes.image.create({
              src: url,
              alt: file.name.replace(/\.[^.]+$/, "") || "图片",
            });
          } catch (err) {
            toast.error(typeof err === "string" ? err : "图片上传失败");
            return null;
          }
        }),
      );

      // 全部失败（或都被跳过）时返回空内容，避免占位装饰残留
      const nodes = uploaded.filter((node): node is ProseNode => node !== null);
      if (!nodes.length) return Fragment.empty;

      // 上传是异步的：插件插入节点后 markdownUpdated 才会回填 tempRef，
      // 这里只打标记，由监听器在回填后主动保存一次描述
      pendingSaveRef.current = true;

      return inline ? nodes : schema.nodes.paragraph.create(null, nodes);
    };
  });

  const { get, loading } = useEditor(
    (root) => {
      const builder = Editor.make()
        .config(nord)
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, defaultValue ?? "");
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => !readOnlyRef.current,
          }));
          ctx
            .get(listenerCtx)
            .markdownUpdated((...args: [unknown, string]) =>
              handleMarkdownUpdatedRef.current(...args),
            );
          ctx.update(uploadConfig.key, (prev) => ({
            ...prev,
            // 覆盖插件默认的英文占位（"Upload in progress..."）为中文提示
            uploadWidgetFactory: (pos, spec) => {
              const widgetDOM = document.createElement("span");
              widgetDOM.textContent = "图片上传中…";
              widgetDOM.className = "text-muted-foreground";
              return Decoration.widget(pos, widgetDOM, spec);
            },
            getInsertPos: (_event, innerCtx, defaultInsertPos) =>
              resolveInsertPos(
                innerCtx.get(editorViewCtx).state,
                defaultInsertPos,
              ),
            uploader: (files, schema, innerCtx, insertPos) =>
              uploaderRef.current(files, schema, innerCtx, insertPos),
          }));
        })
        .use(commonmark)
        .use(listener)
        .use(clipboard)
        .use(indent)
        .use(trailing)
        // 处理粘贴/拖拽图片上传：插入占位装饰 → 异步上传 → 上传成功后替换为 image 节点
        .use(upload);

      const activeCollab = collabRef.current;
      if (activeCollab) {
        // 协作模式：不能再挂 history（Yjs 自带 undo，两套 history 会互相打架）
        builder.use(collab);
      } else {
        // 本地模式：保留原有 history
        builder.use(history);
      }

      return builder;
    },
    [],
  );

  /**
   * 直接按编辑器**当前正文**刷新占位符状态。
   *
   * 为什么不能只靠 `markdownUpdated` 回调：那个回调有 200ms 防抖，而且只在「文档相对上一次
   * 快照发生变化」时才触发。协作模式下文档常常在编辑器挂载前就已经有内容（Yjs 快照 / WS 同步），
   * 挂载后不再有任何变化 —— `isEmpty` 于是永远停在初始值 true，表现就是
   * 「描述里明明有内容，占位符却一直浮在上面」（切换页签回来时最容易看到：
   * 编辑器是重新挂载的，而文档内容没变，回调一次都不会响）。
   */
  const syncEmptyFromDoc = useCallback(() => {
    const editor = get();
    if (!editor) return;
    latestSetIsEmpty.current(
      editor.action((ctx) =>
        isDocSemanticallyEmpty(ctx.get(editorViewCtx).state.doc),
      ),
    );
  }, [get]);

  // 协作绑定必须在编辑器就绪之后做：
  // `collabServiceCtx` 由 `collab` 插件在插件执行阶段注入，`.config()` 回调跑在那之前，
  // 提前取会抛 "Context not bind"。
  useEffect(() => {
    if (loading) return;
    const activeCollab = collabRef.current;
    if (!activeCollab) return;
    const editor = get();
    if (!editor) return;

    editor.action((ctx) => {
      const service = ctx.get(collabServiceCtx).bindCtx(ctx).bindDoc(activeCollab.ydoc);
      // setOptions 必须在 connect 之前：光标插件是在 connect 时按选项创建并挂到编辑器上的。
      // 这里有一次断言：plugin-collab 把自己的 yCursorOpts 声明成 `(arg: any) => …`（少写了
      // 第二个参数），而 y-prosemirror 实际会传 (user, clientId)；我们的实现按真实签名写，
      // 故在注入处窄化回它的宽松声明。
      if (activeCollab.yCursorOpts) {
        service.setOptions({
          yCursorOpts: activeCollab.yCursorOpts as Parameters<
            typeof service.setOptions
          >[0]["yCursorOpts"],
        });
      }
      service.setAwareness(activeCollab.awareness).connect();
    });
    // 绑定是幂等的（CollabService.connect 内部有 #connected 守卫）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, collabConfig]);

  /**
   * 卸载时「编辑器已拆、provider 仍在派发 awareness」那个窗口的保护放在
   * `useCollabDoc` 的清理里（见那里的注释）：迟到的 `change` → `view.dispatch()`
   * 是 `provider.destroy()` 内部同步派发的，在那一刻挡住才是最小且准确的修法。
   */

  // 对外能力：导出（读编辑器正文）/ 导入（整体替换并立即保存）
  // 导入绝不能改 defaultValue —— 它会触发下面的 replaceAll effect，重建文档并丢光标
  useImperativeHandle(
    ref,
    () => ({
      exportMarkdown: () => {
        const editor = get();
        if (loading || !editor) return tempRef.current;
        // 必须问编辑器要正文：tempRef 由 markdownUpdated 200ms 防抖回填，刚敲的字可能还没到
        return editor.action(getMarkdown());
      },
      importMarkdown: async (markdown: string) => {
        if (readOnlyRef.current) return false;
        const editor = get();
        if (loading || !editor) {
          toast.error("编辑器尚未就绪，请稍后重试");
          return false;
        }
        editor.action(replaceAll(markdown));
        // 同步临时值并复用同一条保存路径（focusout 的延迟保存读到的也是这份内容）
        tempRef.current = markdown;
        latestSetIsEmpty.current(isEmptyMarkdown(markdown));
        // 协作模式：replaceAll 是一次 Yjs 事务，本身就会广播给所有人，没有额外的保存步骤
        if (collabRef.current) return true;
        return saveRef.current();
      },
      applySeed: (markdown: string): SeedResult => {
        if (readOnlyRef.current) return "skipped";
        if (!markdown) return "skipped";
        const editor = get();
        if (loading || !editor) return "not-ready";
        // 只在空文档上播种：非空说明已有内容（他人刚写的或已落库的），不能覆盖
        const isEmpty = editor.action((ctx) =>
          isDocSemanticallyEmpty(ctx.get(editorViewCtx).state.doc),
        );
        if (!isEmpty) return "not-empty";
        editor.action(replaceAll(markdown));
        tempRef.current = markdown;
        latestSetIsEmpty.current(isEmptyMarkdown(markdown));
        return "applied";
      },
    }),
    [get, loading],
  );

  // 初始化markdown（仅在 defaultValue 变化时同步）
  // 必须等 loading=false（编辑器就绪，get() 才有值）：defaultValue 若在编辑器创建前到达，
  // 旧写法会因 get() 为空直接 return，之后再无 defaultValue 变化 → 已保存内容永不渲染
  useEffect(() => {
    if (loading) return;
    // 协作模式跳过：正文来自 Y.Doc，用 prop 覆盖会冲掉远端改动（播种走 applySeed）
    if (collabRef.current) return;
    const editor = get();
    if (!editor) return;
    editor.action(replaceAll(defaultValue ?? ""));
    tempRef.current = defaultValue ?? "";
    lastSavedRef.current = defaultValue ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue, loading]);

  /**
   * 编辑器就绪后按当前正文校准占位符状态。
   *
   * 这是「内容已有但占位符还在」的兜底：协作模式下正文来自 Yjs 快照，挂载后不再变化，
   * `markdownUpdated` 一次都不会回调；重新挂载（切页签回来 / 刷新）时最容易复现。
   */
  useEffect(() => {
    if (loading) return;
    syncEmptyFromDoc();
  }, [loading, syncEmptyFromDoc]);

  // 设置是否可编辑 — 依赖 loading，确保编辑器创建完成后应用（修复挂载时 get() 为空导致只读不生效）
  useEffect(() => {
    if (loading) return;
    const editor = get();
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.setProps({
        editable: () => !readOnlyRef.current,
      });
      // 只读时移除 tabindex：contenteditable=false 且无 tabindex 的元素无法被点击/Tab 聚焦
      // （tabindex=-1 仍会被鼠标点击聚焦，故用 removeAttribute）
      const prosemirror =
        containerRef.current?.querySelector<HTMLElement>(".ProseMirror");
      prosemirror?.removeAttribute("tabindex");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, loading]);

  // 保存描述 + 焦点追踪
  useEffect(() => {
    const container = containerRef.current;
    if (!container || readOnly || collabConfig) return;

    const handleFocusOut = (e: FocusEvent) => {
      if (!container.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
        // markdownUpdated 有 200ms 防抖：输入后立刻失焦时 tempRef 可能还没回填，
        // 直接保存会丢掉最后敲的几个字；延后一点再读 tempRef
        window.setTimeout(() => saveRef.current(), SAVE_SETTLE_MS);
      }
    };

    const handleFocusIn = () => {
      setIsFocused(true);
    };

    container.addEventListener("focusout", handleFocusOut);
    container.addEventListener("focusin", handleFocusIn);
    return () => {
      container.removeEventListener("focusout", handleFocusOut);
      container.removeEventListener("focusin", handleFocusIn);
    };
  }, [readOnly, saveDescription, collabConfig]);

  // 离开页面时保存描述
  useEffect(() => {
    // 协作模式不保存：内容已经通过 Yjs 同步，beforeunload 里再发一次 HTTP 没有意义
    if (readOnly || collabConfig) return;

    const handleBeforeUnload = () => {
      const current = tempRef.current;
      if (current !== lastSavedRef.current) {
        saveDescription();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, readOnly]);

  // 点击容器时聚焦
  const handleContainerClick = useCallback(() => {
    if (readOnly) return;
    const prosemirror =
      containerRef.current?.querySelector<HTMLElement>(".ProseMirror");
    if (prosemirror && document.activeElement !== prosemirror) {
      prosemirror.focus();
    }
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      data-slot="md-editor"
      className="relative min-h-[60px] [font-size:16px]"
      onClick={handleContainerClick}
    >
      {isEmpty && !isFocused && !readOnly && (
        <div
          data-slot="md-editor-placeholder"
          className="pointer-events-none absolute inset-0 flex items-start text-muted-foreground select-none"
          style={{ padding: "inherit" }}
        >
          {placeholder}
        </div>
      )}
      <Milkdown />
    </div>
  );
}

export function MdEditor({
  wrapperClassName = "mt-5 bg-background px-3 text-sm text-stone-600",
  ...props
}: MdEditorProps) {
  return (
    <MilkdownProvider>
      <div className={`${wrapperClassName} [&_.ProseMirror:focus]:outline-none`}>
        <EditorContent {...props} />
      </div>
    </MilkdownProvider>
  );
}
