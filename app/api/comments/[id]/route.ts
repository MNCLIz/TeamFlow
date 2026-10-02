import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import {
  COMMENT_EXCERPT_LENGTH,
  COMMENT_INCLUDE,
  validateCommentContent,
} from "@/lib/comment-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await params;

    const body = await request.json();
    const { content, resolved } = body as {
      content?: unknown;
      resolved?: unknown;
    };

    if (content === undefined && resolved === undefined) {
      const err = errorResponse("没有提供需要更新的字段");
      return NextResponse.json(err.response, { status: err.status });
    }

    let trimmedContent: string | null = null;
    if (content !== undefined) {
      const validated = validateCommentContent(content);
      if ("error" in validated) {
        const err = errorResponse(validated.error);
        return NextResponse.json(err.response, { status: err.status });
      }
      trimmedContent = validated.content;
    }

    if (resolved !== undefined && typeof resolved !== "boolean") {
      const err = errorResponse("参数 resolved 必须为布尔值");
      return NextResponse.json(err.response, { status: err.status });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        projectId: true,
        cardId: true,
        authorId: true,
        content: true,
        resolved: true,
      },
    });

    if (!comment) {
      const err = errorResponse("评论不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const member = await checkProjectAccess(comment.projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const data: {
      content?: string;
      editedAt?: Date;
      resolved?: boolean;
      resolvedAt?: Date | null;
      resolvedById?: string | null;
    } = {};

    // 正文仅作者可改；内容未变化时不写 editedAt，避免出现无意义的"已编辑"
    if (trimmedContent !== null) {
      if (comment.authorId !== user.id) {
        const err = errorResponse("只有作者可以编辑评论", 403);
        return NextResponse.json(err.response, { status: err.status });
      }
      if (trimmedContent !== comment.content) {
        data.content = trimmedContent;
        data.editedAt = new Date();
      }
    }

    // 解决状态任何成员可切换；状态未变化时保持原解决人与时间（幂等）
    let resolvedChanged = false;
    if (typeof resolved === "boolean" && resolved !== comment.resolved) {
      data.resolved = resolved;
      data.resolvedAt = resolved ? new Date() : null;
      data.resolvedById = resolved ? user.id : null;
      resolvedChanged = true;
    }

    // 无实际变化：返回当前评论，不写活动记录也不广播
    if (Object.keys(data).length === 0) {
      const current = await prisma.comment.findUnique({
        where: { id: commentId },
        include: COMMENT_INCLUDE,
      });
      return NextResponse.json(successResponse(current));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.comment.update({
        where: { id: commentId },
        data,
        include: COMMENT_INCLUDE,
      });

      if (resolvedChanged) {
        await tx.activity.create({
          data: {
            projectId: comment.projectId,
            userId: user.id,
            cardId: comment.cardId,
            action: "RESOLVE_COMMENT",
            details: JSON.stringify({ commentId, resolved }),
          },
        });
      }

      return result;
    });

    broadcast(comment.projectId, "comment:updated", updated);

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("更新评论失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        projectId: true,
        cardId: true,
        authorId: true,
        content: true,
        project: { select: { ownerId: true } },
      },
    });

    if (!comment) {
      const err = errorResponse("评论不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const member = await checkProjectAccess(comment.projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 删除权限：作者本人、项目 ADMIN、项目 owner
    const canDelete =
      comment.authorId === user.id ||
      member.role === "ADMIN" ||
      comment.project.ownerId === user.id;

    if (!canDelete) {
      const err = errorResponse("无权删除该评论", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      await tx.activity.create({
        data: {
          projectId: comment.projectId,
          userId: user.id,
          cardId: comment.cardId,
          action: "DELETE_COMMENT",
          details: JSON.stringify({
            commentId,
            scope: comment.cardId ? "CARD" : "PROJECT",
            excerpt: comment.content.slice(0, COMMENT_EXCERPT_LENGTH),
          }),
        },
      });
    });

    broadcast(comment.projectId, "comment:deleted", {
      commentId,
      cardId: comment.cardId,
      projectId: comment.projectId,
    });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("删除评论失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
