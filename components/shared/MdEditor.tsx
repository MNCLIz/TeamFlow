"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
import { replaceAll } from "@milkdown/kit/utils";
import { Fragment, type Node as ProseNode } from "@milkdown/prose/model";
import type { EditorState } from "@milkdown/prose/state";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";
import { toast } from "sonner";
import { postImageAPI } from "@/lib/api/ImageAPI";
import "@/app/projects/[id]/Details/milkdown-scoped.css";

interface MdEditorProps {
  id: string;
  defaultValue?: string;
  readOnly?: boolean;
  placeholder?: string;
  updateDescription: (params: {
    id: string;
    name?: string;
    description?: string;
  }) => Promise<void>;
}

function isEmptyMarkdown(markdown: string | null): boolean {
  return markdown && markdown.trim() ? false : true;
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
  placeholder = "Add a description...",
  updateDescription,
}: MdEditorProps) {
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
  const saveDescription = useCallback(async () => {
    const current = tempRef.current;
    if (current === lastSavedRef.current) return;
    try {
      // 只提交一次：latestOnSave 始终指向最新的 updateDescription
      // （原实现在 await updateDescription 之后又用同一份参数调了一次，导致每次保存发两个 PATCH）
      await latestOnSave.current({ id, description: current });
      lastSavedRef.current = current;
    } catch {
      toast.error("保存失败，请稍后再试");
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
    (root) =>
      Editor.make()
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
        .use(history)
        .use(clipboard)
        .use(indent)
        .use(trailing)
        // 处理粘贴/拖拽图片上传：插入占位装饰 → 异步上传 → 上传成功后替换为 image 节点
        .use(upload),
    [],
  );

  // 初始化markdown（仅在 defaultValue 变化时同步）
  // 必须等 loading=false（编辑器就绪，get() 才有值）：defaultValue 若在编辑器创建前到达，
  // 旧写法会因 get() 为空直接 return，之后再无 defaultValue 变化 → 已保存内容永不渲染
  useEffect(() => {
    if (loading) return;
    const editor = get();
    if (!editor) return;
    editor.action(replaceAll(defaultValue ?? ""));
    tempRef.current = defaultValue ?? "";
    lastSavedRef.current = defaultValue ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue, loading]);

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
    if (!container || readOnly) return;

    const handleFocusOut = (e: FocusEvent) => {
      if (!container.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
        saveDescription();
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
  }, [readOnly, saveDescription]);

  // 离开页面时保存描述
  useEffect(() => {
    if (readOnly) return;

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
      className="relative min-h-[60px] [font-size:16px]"
      onClick={handleContainerClick}
    >
      {isEmpty && !isFocused && !readOnly && (
        <div
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

export function MdEditor(props: MdEditorProps) {
  return (
    <MilkdownProvider>
      <div className="mt-5 bg-background px-3 text-sm text-stone-600 [&_.ProseMirror:focus]:outline-none">
        <EditorContent {...props} />
      </div>
    </MilkdownProvider>
  );
}
