"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { indent } from "@milkdown/kit/plugin/indent";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { nord } from "@milkdown/theme-nord";
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
      await updateDescription({
        id: id,
        description: current,
      });
      lastSavedRef.current = current;
      latestOnSave.current?.({ id, description: current });
    } catch {
      // TODO: 错误处理
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 处理markdown更新 — 用 ref 保持最新引用，避免 useEditor factory 重建
  const latestSetIsEmpty = useRef(setIsEmpty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    latestSetIsEmpty.current = setIsEmpty;
  });

  const handleMarkdownUpdatedRef = useRef((_ctx: unknown, markdown: string) => {
    tempRef.current = markdown;
    latestSetIsEmpty.current(isEmptyMarkdown(markdown));
  });

  // 创建编辑器（空 deps → 只创建一次，通过 ref 读取最新回调）
  const { get } = useEditor(
    (root) =>
      Editor.make()
        .config(nord)
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, defaultValue ?? "");
          ctx
            .get(listenerCtx)
            .markdownUpdated((...args: [unknown, string]) =>
              handleMarkdownUpdatedRef.current(...args),
            );
        })
        .use(commonmark)
        .use(listener)
        .use(history)
        .use(clipboard)
        .use(indent)
        .use(trailing),
    [],
  );

  // 初始化markdown（仅在 defaultValue 变化时同步）
  useEffect(() => {
    const editor = get();
    if (!editor) return;
    editor.action(replaceAll(defaultValue ?? ""));
    tempRef.current = defaultValue ?? "";
    lastSavedRef.current = defaultValue ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  // 设置是否可编辑
  useEffect(() => {
    const editor = get();
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.setProps({
        ...view.props,
        editable: () => !readOnly,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

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
      <div className="mt-5 bg-background px-3 py-2 text-sm text-stone-600 [&_.ProseMirror:focus]:outline-none">
        <EditorContent {...props} />
      </div>
    </MilkdownProvider>
  );
}
