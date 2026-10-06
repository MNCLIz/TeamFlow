"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { Download, MoreHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadMarkdown,
  markdownFileName,
  readMarkdownFile,
} from "@/lib/markdown-file";
import type { MdEditorHandle } from "@/components/shared/MdEditor";

// 与 lib/markdown-file.ts 的后缀白名单一致（accept 只是给文件选择器的提示，真正的校验在 readMarkdownFile）
const IMPORT_ACCEPT = ".md,.markdown,.txt,text/markdown,text/plain";

const itemClass =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Markdown 描述的导入 / 导出入口。
// 读写都走 MdEditor 的 ref handle：导出必须拿编辑器当前正文（tempRef 有 200ms 防抖滞后），
// 导入由编辑器内部 replaceAll + 复用既有保存路径，不在这里另写一条 PATCH。
export function MdFileActions({
  editorRef,
  title,
  fallbackId,
  variant = "row",
  readOnly = false,
  className,
}: {
  editorRef: RefObject<MdEditorHandle | null>;
  // 文件名 / 确认文案来源：项目名 / 卡片标题
  title: string;
  // 标题为空时的文件名回退：项目 id / 卡片 id
  fallbackId: string;
  // row：标题行右侧的图标按钮（项目描述）；menu：「⋯」下拉，用于卡片详情这类窄容器
  variant?: "row" | "menu";
  // MEMBER 只读：不渲染导入入口（导出是纯读操作，仍可用）
  readOnly?: boolean;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 读好但还没落库的内容：已有描述时先弹确认框，确认后才整体替换
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  const handleExport = () => {
    const markdown = editorRef.current?.exportMarkdown() ?? "";
    if (!markdown.trim()) {
      toast.info("当前描述为空，没有可导出的内容");
      return;
    }
    downloadMarkdown(markdownFileName(title, fallbackId), markdown);
    toast.success("已导出 Markdown 文件");
  };

  const applyImport = async (markdown: string) => {
    // 返回 false 的原因（未就绪 / 保存失败）已由编辑器侧提示，这里不重复弹
    const saved = await editorRef.current?.importMarkdown(markdown);
    if (saved) toast.success("已导入 Markdown 文件");
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 立刻清空：同一个文件连续导入两次也要能再次触发 change
    event.target.value = "";
    if (!file) return;

    const result = await readMarkdownFile(file);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // 导入是整体覆盖、不追加：当前已有描述时必须先确认
    const current = editorRef.current?.exportMarkdown() ?? "";
    if (current.trim()) {
      setPendingImport(result.markdown);
      return;
    }
    await applyImport(result.markdown);
  };

  return (
    <div
      data-slot="md-file-actions"
      className={`flex items-center gap-1 ${className ?? ""}`}
    >
      {variant === "menu" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-slot="md-file-menu"
            aria-label="Markdown 操作"
            title="Markdown 操作"
            className={itemClass}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-[160px]">
            {!readOnly && (
              <DropdownMenuItem
                data-slot="md-import"
                className="cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                导入 Markdown
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              data-slot="md-export"
              className="cursor-pointer"
              onClick={handleExport}
            >
              <Download className="size-4" />
              导出 Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="导入 Markdown"
              title="导入 Markdown"
              data-slot="md-import"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="导出 Markdown"
            title="导出 Markdown"
            data-slot="md-export"
            onClick={handleExport}
          >
            <Download />
          </Button>
        </>
      )}

      {/* 隐藏的文件选择器：导入入口只负责触发它，真正的校验在 readMarkdownFile */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={handleImportChange}
      />

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖当前描述？</AlertDialogTitle>
            <AlertDialogDescription>
              导入会用文件内容整体替换
              {title ? `「${title}」` : "当前"}
              的描述，原有内容不会保留（编辑器内仍可用 Ctrl+Z 撤销）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              data-slot="md-import-confirm"
              onClick={() => {
                const markdown = pendingImport;
                setPendingImport(null);
                if (markdown !== null) void applyImport(markdown);
              }}
            >
              覆盖导入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
