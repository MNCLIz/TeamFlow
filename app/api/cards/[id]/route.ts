import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import { Priority } from "@/types/board";

const VALID_PRIORITIES: Priority[] = [Priority.Low, Priority.Medium, Priority.High];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: cardId } = await params;

    const body = await request.json();
    const { title, description, priority, dueDate, assigneeId, labelIds } = body as {
      title?: string;
      description?: string | null;
      priority?: Priority;
      dueDate?: string | null;
      assigneeId?: string | null;
      labelIds?: string[];
    };

    if (
      title === undefined &&
      description === undefined &&
      priority === undefined &&
      dueDate === undefined &&
      assigneeId === undefined &&
      labelIds === undefined
    ) {
      const err = errorResponse("没有提供需要更新的字段");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      const err = errorResponse("无效的优先级，可选值：LOW、MEDIUM、HIGH");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (title !== undefined && title.trim().length === 0) {
      const err = errorResponse("标题不能为空");
      return NextResponse.json(err.response, { status: err.status });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { column: { select: { projectId: true } } },
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

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) data.assigneeId = assigneeId;

    const updatedCard = await prisma.$transaction(async (tx) => {
      if (labelIds !== undefined) {
        await tx.card.update({
          where: { id: cardId },
          data: { labels: { set: labelIds.map((id) => ({ id })) } },
        });
      }

      const result = await tx.card.update({
        where: { id: cardId },
        data,
        include: { labels: true },
      });

      const changedFields = Object.keys(data);
      if (labelIds !== undefined) changedFields.push("labelIds");

      await tx.activity.create({
        data: {
          projectId: card.column.projectId,
          userId: user.id,
          cardId,
          action: "UPDATE_CARD",
          details: JSON.stringify(changedFields),
        },
      });

      return result;
    });

    broadcast(card.column.projectId, "card:updated", updatedCard);

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
      select: { title: true, column: { select: { projectId: true } } },
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

    await prisma.$transaction(async (tx) => {
      await tx.card.delete({ where: { id: cardId } });

      await tx.activity.create({
        data: {
          projectId: card.column.projectId,
          userId: user.id,
          cardId,
          action: "DELETE_CARD",
          details: JSON.stringify({ title: card.title }),
        },
      });
    });

    broadcast(card.column.projectId, "card:deleted", { cardId });

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
