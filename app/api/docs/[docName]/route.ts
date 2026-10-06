import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { checkDocAccess } from "@/lib/collab/doc-access";
import { parseDocumentName } from "@/lib/collab/doc-key";
import { bytesToBase64 } from "@/lib/collab/projection";

export const dynamic = "force-dynamic";

/**
 * 协作文档的初始状态。
 *
 * 用途：
 * - 让客户端在建立 WS 之前就知道自己是否只读（连不上 WS 时的降级渲染）
 * - 提供已落库的 Yjs 快照（离线 / 秒开优化；正常情况下内容由 WS 同步补齐）
 * - 首次打开时把既有的 `description` 作为播种内容下发（客户端 applyTemplate 用它初始化空文档）
 *
 * `docName` 由 documentName 去掉 `-` 得到，见 lib/collab/doc-key.ts 顶部说明。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ docName: string }> },
) {
  try {
    const user = await requireAuth();
    const { docName } = await params;

    if (!parseDocumentName(docName)) {
      const err = errorResponse("文档标识不合法", 400);
      return NextResponse.json(err.response, { status: err.status });
    }

    const access = await checkDocAccess(docName, user.id);
    if (!access) {
      const err = errorResponse("无权访问该文档", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const [row, seed] = await Promise.all([
      prisma.document.findFirst({
        where: access.key.kind === "project"
          ? { projectId: access.key.id }
          : { cardId: access.key.id },
        select: { yjsState: true, markdown: true, version: true, updatedAt: true },
      }),
      readSeedMarkdown(access.key.kind, access.key.id),
    ]);

    return NextResponse.json(
      successResponse({
        docName,
        // 初始快照（base64）；为 null 表示服务端还没有落库过，内容以 seedMarkdown 为准
        state: row?.yjsState?.byteLength
          ? bytesToBase64(new Uint8Array(row.yjsState))
          : null,
        markdown: row?.markdown ?? seed ?? "",
        seedMarkdown: seed ?? "",
        version: row?.version ? Number(row.version) : 0,
        readOnly: !access.canWrite,
        role: access.role,
        updatedAt: row?.updatedAt?.toISOString() ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    console.error("[collab] 读取文档初始状态失败:", error);
    const err = errorResponse("读取文档失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

async function readSeedMarkdown(
  kind: "project" | "card",
  id: string,
): Promise<string | null> {
  if (kind === "project") {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { description: true },
    });
    return project?.description ?? null;
  }
  const card = await prisma.card.findUnique({
    where: { id },
    select: { description: true },
  });
  return card?.description ?? null;
}
