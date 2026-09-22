import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import { Priority, TaskState } from "@/types/board";

const VALID_PRIORITIES: Priority[] = [Priority.Low, Priority.Medium, Priority.High];
const VALID_STATES = Object.values(TaskState) as string[];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: cardId } = await params;

    const body = await request.json();
    const { title, description, priority, dueDate, assigneeId, state } = body as {
      title?: string;
      description?: string | null;
      priority?: Priority;
      dueDate?: string | null;
      assigneeId?: string | null;
      state?: TaskState;
    };

    if (
      title === undefined &&
      description === undefined &&
      priority === undefined &&
      dueDate === undefined &&
      assigneeId === undefined &&
      state === undefined
    ) {
      const err = errorResponse("没有提供需要更新的字段");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      const err = errorResponse("无效的优先级，可选值：LOW、MEDIUM、HIGH");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (state !== undefined && !VALID_STATES.includes(state)) {
      const err = errorResponse("无效的任务状态");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (title !== undefined && title.trim().length === 0) {
      const err = errorResponse("标题不能为空");
      return NextResponse.json(err.response, { status: err.status });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { projectId: true, state: true },
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

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId;

    const fromState = card.state;
    const isStateChange = state !== undefined && state !== fromState;

    if (isStateChange) {
      const lastCard = await prisma.card.findFirst({
        where: { state },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      data.state = state;
      data.order = (lastCard?.order ?? -1) + 1;
    }

    const updatedCard = await prisma.$transaction(async (tx) => {
      const result = await tx.card.update({
        where: { id: cardId },
        data,
      });

      if (card.projectId) {
        if (isStateChange) {
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

        const updatedFields = Object.keys(data).filter(
          (key) => key !== "state" && key !== "order"
        );
        if (updatedFields.length > 0) {
          await tx.activity.create({
            data: {
              projectId: card.projectId,
              userId: user.id,
              cardId,
              action: "UPDATE_CARD",
              details: JSON.stringify(updatedFields),
            },
          });
        }
      }

      return result;
    });

    if (card.projectId) {
      broadcast(card.projectId, "card:updated", updatedCard);
      if (isStateChange) {
        broadcast(card.projectId, "card:moved", {
          cardId,
          fromState,
          toState: state,
          order: updatedCard.order,
        });
      }
    }

    return NextResponse.json(successResponse(updatedCard));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("更新卡片失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: cardId } = await params;

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { title: true, projectId: true },
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

    await prisma.$transaction(async (tx) => {
      await tx.card.delete({ where: { id: cardId } });

      if (card.projectId) {
        await tx.activity.create({
          data: {
            projectId: card.projectId,
            userId: user.id,
            cardId,
            action: "DELETE_CARD",
            details: JSON.stringify({ title: card.title }),
          },
        });
      }
    });

    if (card.projectId) {
      broadcast(card.projectId, "card:deleted", { cardId });
    }

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("删除卡片失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
