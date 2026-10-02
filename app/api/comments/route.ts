import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import {
  COMMENT_EXCERPT_LENGTH,
  COMMENT_INCLUDE,
  resolveCommentScope,
  validateCommentContent,
} from "@/lib/comment-utils";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const url = new URL(request.url);
    const resolved = await resolveCommentScope(
      url.searchParams.get("cardId"),
      url.searchParams.get("projectId")
    );

    if ("error" in resolved) {
      const err = errorResponse(resolved.error.message, resolved.error.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    const { projectId, cardId } = resolved.scope;

    const member = await checkProjectAccess(projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 项目级讨论与卡片评论共用此端点：cardId 为 null 即项目级
    const comments = await prisma.comment.findMany({
      where: { projectId, cardId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(successResponse(comments));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取评论列表失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { content, cardId, projectId } = body as {
      content?: unknown;
      cardId?: unknown;
      projectId?: unknown;
    };

    const validated = validateCommentContent(content);
    if ("error" in validated) {
      const err = errorResponse(validated.error);
      return NextResponse.json(err.response, { status: err.status });
    }

    if (cardId !== undefined && cardId !== null && typeof cardId !== "string") {
      const err = errorResponse("参数 cardId 类型错误");
      return NextResponse.json(err.response, { status: err.status });
    }
    if (projectId !== undefined && projectId !== null && typeof projectId !== "string") {
      const err = errorResponse("参数 projectId 类型错误");
      return NextResponse.json(err.response, { status: err.status });
    }

    const resolved = await resolveCommentScope(cardId ?? null, projectId ?? null);
    if ("error" in resolved) {
      const err = errorResponse(resolved.error.message, resolved.error.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    const scope = resolved.scope;

    const member = await checkProjectAccess(scope.projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          content: validated.content,
          projectId: scope.projectId,
          cardId: scope.cardId,
          authorId: user.id,
        },
        include: COMMENT_INCLUDE,
      });

      await tx.activity.create({
        data: {
          projectId: scope.projectId,
          userId: user.id,
          cardId: scope.cardId,
          action: "ADD_COMMENT",
          details: JSON.stringify({
            commentId: created.id,
            scope: scope.cardId ? "CARD" : "PROJECT",
            excerpt: validated.content.slice(0, COMMENT_EXCERPT_LENGTH),
          }),
        },
      });

      return created;
    });

    broadcast(scope.projectId, "comment:created", comment);

    return NextResponse.json(successResponse(comment), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("创建评论失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
