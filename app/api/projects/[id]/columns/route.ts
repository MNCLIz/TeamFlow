import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import type { BoardColumn } from "@/types/board";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;

    const member = await checkProjectAccess(projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const columns = await prisma.column.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
      include: {
        cards: {
          orderBy: { order: "asc" },
          include: {
            labels: true,
            attachments: true,
          },
        },
      },
    });

    const boardColumns: BoardColumn[] = columns.map((col) => ({
      id: col.id,
      name: col.name,
      order: col.order,
      cards: col.cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        content: card.content,
        priority: card.priority as BoardColumn["cards"][number]["priority"],
        dueDate: card.dueDate,
        order: card.order,
        columnId: card.columnId,
        createdById: card.createdById,
        assigneeId: card.assigneeId,
        labels: card.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
        attachments: card.attachments.map((a) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          size: a.size,
          mimeType: a.mimeType,
          createdAt: a.createdAt,
        })),
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      })),
    }));

    return NextResponse.json(successResponse(boardColumns));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取看板数据失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
