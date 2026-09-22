import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import { TaskState } from "@/types/board";

const VALID_STATES = Object.values(TaskState) as string[];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: cardId } = await params;

    const body = await request.json();
    const { state, order } = body as { state?: string; order?: number };

    if (state === undefined || order === undefined) {
      const err = errorResponse("缺少必要参数 state 或 order");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (!VALID_STATES.includes(state)) {
      const err = errorResponse("无效的任务状态");
      return NextResponse.json(err.response, { status: err.status });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { state: true, projectId: true },
    });

    if (!card) {
      const err = errorResponse("卡片不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    if (card.projectId) {
      const member = await checkProjectAccess(card.projectId, user.id);
      if (!member) {
        const err = errorResponse("无权操作该卡片", 403);
        return NextResponse.json(err.response, { status: err.status });
      }
    }

    const fromState = card.state;
    const isMove = fromState !== state;

    const updatedCard = await prisma.$transaction(async (tx) => {
      const result = await tx.card.update({
        where: { id: cardId },
        data: { state: state as TaskState, order },
      });

      if (isMove && card.projectId) {
        await tx.activity.create({
          data: {
            projectId: card.projectId,
            userId: user.id,
            cardId,
            action: "MOVE_CARD",
            details: JSON.stringify({ fromState, toState: state }),
          },
        });
      }

      return result;
    });

    if (card.projectId) {
      broadcast(card.projectId, "card:moved", {
        cardId,
        fromState,
        toState: state,
        order,
      });
    }

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
