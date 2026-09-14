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
    const { id: projectId } = await params;

    const member = await checkProjectAccess(projectId, user.id);
    if (!member) {
      const err = errorResponse("无权操作该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const body = await request.json();
    const { title, description, content, priority, columnId, assigneeId, labelIds } = body as {
      title?: string;
      description?: string;
      content?: string;
      priority?: string;
      columnId?: string;
      assigneeId?: string | null;
      labelIds?: string[];
    };

    if (!title || !columnId) {
      const err = errorResponse("缺少必要参数 title 或 columnId");
      return NextResponse.json(err.response, { status: err.status });
    }

    const column = await prisma.column.findFirst({
      where: { id: columnId, projectId },
    });

    if (!column) {
      const err = errorResponse("列不存在或不属于该项目", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const lastCard = await prisma.card.findFirst({
      where: { columnId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const newOrder = (lastCard?.order ?? -1) + 1;

    const validPriorities = ["LOW", "MEDIUM", "HIGH"];
    const cardPriority = priority && validPriorities.includes(priority) ? priority : "MEDIUM";

    const card = await prisma.$transaction(async (tx) => {
      const newCard = await tx.card.create({
        data: {
          title,
          description: description || null,
          content: content || null,
          priority: cardPriority,
          order: newOrder,
          columnId,
          createdById: user.id,
          assigneeId: assigneeId || null,
          ...(labelIds && labelIds.length > 0
            ? { labels: { connect: labelIds.map((id) => ({ id })) } }
            : {}),
        },
        include: { labels: true, attachments: true },
      });

      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          cardId: newCard.id,
          action: "CREATE_CARD",
          details: JSON.stringify({ title }),
        },
      });

      return newCard;
    });

    broadcast(projectId, "card:created", card);

    return NextResponse.json(successResponse(card));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("创建卡片失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
