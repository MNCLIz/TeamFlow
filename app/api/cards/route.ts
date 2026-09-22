import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import { TaskState } from "@/types/board";

const VALID_STATES = Object.values(TaskState) as string[];
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { title, description, priority, state, projectId, assigneeId } =
      body as {
        title?: string;
        description?: string;
        priority?: string;
        state?: string;
        projectId?: string | null;
        assigneeId?: string | null;
      };

    if (!title || title.trim().length === 0) {
      const err = errorResponse("缺少必要参数 title");
      return NextResponse.json(err.response, { status: err.status });
    }

    const targetState = state ?? TaskState.Todo;
    if (!VALID_STATES.includes(targetState)) {
      const err = errorResponse("无效的任务状态");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (projectId) {
      const member = await checkProjectAccess(projectId, user.id);
      if (!member) {
        const err = errorResponse("无权操作该项目", 403);
        return NextResponse.json(err.response, { status: err.status });
      }
    }

    const lastCard = await prisma.card.findFirst({
      where: { state: targetState as TaskState, projectId: projectId ?? null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const newOrder = (lastCard?.order ?? -1) + 1;

    const cardPriority =
      priority && VALID_PRIORITIES.includes(priority) ? priority : "LOW";

    const card = await prisma.$transaction(async (tx) => {
      const newCard = await tx.card.create({
        data: {
          title: title.trim(),
          description: description || null,
          priority: cardPriority,
          order: newOrder,
          state: targetState as TaskState,
          projectId: projectId ?? null,
          createdById: user.id,
          assigneeId: assigneeId || null,
        },
      });

      if (projectId) {
        await tx.activity.create({
          data: {
            projectId,
            userId: user.id,
            cardId: newCard.id,
            action: "CREATE_CARD",
            details: JSON.stringify({ title: newCard.title }),
          },
        });
      }

      return newCard;
    });

    if (projectId) {
      broadcast(projectId, "card:created", card);
    }

    return NextResponse.json(successResponse(card), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("创建卡片失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
