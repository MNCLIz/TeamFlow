// Markdown 描述导入 / 导出：纯客户端工具（客户端组件可直接引用，禁止在此引入 Prisma）
// 调用方见 components/shared/MdEditor/MdFileActions.tsx

import { MAX_DESCRIPTION_BYTES, isDescriptionWithinLimit } from "@/lib/description-limit";

// 单个文件上限：描述不该有这种体量，先在本地拦住，避免白读一遍再失败
export const MAX_MARKDOWN_FILE_BYTES = 1024 * 1024;

export const MARKDOWN_FILE_EXTENSIONS = [".md", ".markdown", ".txt"];

export type ReadMarkdownResult =
  | { ok: true; markdown: string }
  | { ok: false; error: string };

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

export function isMarkdownFile(file: File): boolean {
  return MARKDOWN_FILE_EXTENSIONS.includes(extensionOf(file.name));
}

/** 去 BOM + 统一换行为 \n（Windows 编辑器导出的 CRLF 会被 Markdown 当作硬换行） */
export function normalizeMarkdown(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

/**
 * 读取本地 .md 文件：后缀白名单 → 文件体积 → 解码 → 归一化 → 空文件 / 描述上限校验
 * 失败时返回中文提示，交由调用方 toast，不抛异常
 */
export async function readMarkdownFile(
  file: File,
): Promise<ReadMarkdownResult> {
  if (!isMarkdownFile(file)) {
    return {
      ok: false,
      error: `仅支持 ${MARKDOWN_FILE_EXTENSIONS.join(" / ")} 文件`,
    };
  }
  if (file.size > MAX_MARKDOWN_FILE_BYTES) {
    return {
      ok: false,
      error: `文件超过 ${formatBytes(MAX_MARKDOWN_FILE_BYTES)}，无法导入`,
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "文件读取失败，请重试" };
  }

  const markdown = normalizeMarkdown(text);
  if (!markdown.trim()) {
    return { ok: false, error: "文件内容为空，已取消导入" };
  }
  if (!isDescriptionWithinLimit(markdown)) {
    return {
      ok: false,
      error: `内容超过上限 ${MAX_DESCRIPTION_BYTES} 字节，无法导入`,
    };
  }

  return { ok: true, markdown };
}

/** 文件名：标题 slug 化（保留中文），空标题回退 description-<id 前 8 位> + 日期 */
export function markdownFileName(
  title: string,
  fallbackId: string,
  date: Date = new Date(),
): string {
  const base =
    sanitizeFileName(title) || `description-${fallbackId.slice(0, 8)}`;
  return `${base}-${formatDateStamp(date)}.md`;
}

function sanitizeFileName(title: string): string {
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60)
    .replace(/[-.]+$/, "");
}

function formatDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * 触发浏览器下载：内容原样写入（不加 BOM、不补尾随换行），
 * 保证「导出 → 再导入」内容一致
 */
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 稍后回收：立刻 revoke 在部分浏览器会打断下载
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
