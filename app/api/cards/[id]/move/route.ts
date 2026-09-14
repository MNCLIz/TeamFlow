import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: cardId } = await params;

    const body = await request.json();
    const { columnId, order } = body as { columnId?: string; order?: number };

    if (columnId === undefined || order === undefined) {
      const err = errorResponse("缺少必要参数 columnId 或 order");
      return NextResponse.json(err.response, { status: err.status });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { columnId: true, column: { select: { projectId: true } } },
    });

    if (!card) {
      const err = errorResponse("卡片不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const member = await checkProjectAccess(card.column.projectId, user.id);
    if (!member) {
      const err = errorResponse("无权操作该卡片", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const fromColumnId = card.columnId;
    const isMove = fromColumnId !== columnId;

    const updatedCard = await prisma.$transaction(async (tx) => {
      const result = await tx.card.update({
        where: { id: cardId },
        data: { columnId, order },
      });

      if (isMove) {
        await tx.activity.create({
          data: {
            projectId: card.column.projectId,
            userId: user.id,
            cardId,
            action: "MOVE_CARD",
            details: JSON.stringify({ fromColumnId, toColumnId: columnId }),
          },
        });
      }

      return result;
    });

    broadcast(card.column.projectId, "card:moved", {
      cardId,
      fromColumnId,
      toColumnId: columnId,
      order,
    });

    return NextResponse.json(successResponse(updatedCard));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("移动卡片失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
