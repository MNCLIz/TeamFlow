import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import type { ColumnType, CardType } from "@/types/board";
import { TASK_STATE_ORDER, TASK_STATE_LABELS, TaskState } from "@/types/board";

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

    const cards = await prisma.card.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });

    const boardColumns: ColumnType[] = TASK_STATE_ORDER.map((state) => ({
      state,
      name: TASK_STATE_LABELS[state],
      projectId,
      cards: cards
        .filter((card) => card.state === state)
        .map((card) => ({
          id: card.id,
          title: card.title,
          description: card.description,
          priority: card.priority as CardType["priority"],
          dueDate: card.dueDate,
          order: card.order,
          state: card.state as TaskState,
          projectId: card.projectId,
          createdById: card.createdById,
          assigneeId: card.assigneeId,
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
