import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import {
  checkCommentScopeAccess,
  COMMENT_EXCERPT_LENGTH,
  COMMENT_INCLUDE,
  commentScopeOf,
  validateCommentContent,
  validateMentions,
  type CommentMentionInput,
} from "@/lib/comment-utils";

// 比对提及是否变化用的唯一键：同一个人在同一位置只算一条
function mentionKey(mention: CommentMentionInput): string {
  return `${mention.userId}:${mention.start}:${mention.end}`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: commentId } = await params;

    const body = await request.json();
    const { content, resolved, parentId, mentions } = body as {
      content?: unknown;
      resolved?: unknown;
      parentId?: unknown;
      mentions?: unknown;
    };

    // 引用关系创建后不可修改
    if (parentId !== undefined) {
      const err = errorResponse("不支持修改评论的引用关系");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (content === undefined && resolved === undefined && mentions === undefined) {
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
        mentions: { select: { userId: true, start: true, end: true } },
      },
    });

    if (!comment) {
      const err = errorResponse("评论不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const scope = commentScopeOf(comment);
    if (!scope) {
      const err = errorResponse("评论作用域异常", 500);
      return NextResponse.json(err.response, { status: err.status });
    }

    const access = await checkCommentScopeAccess(scope, user.id);
    if (!access.ok) {
      const err = errorResponse(access.message, access.status);
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

    // 提及成员与正文同属评论内容：仅作者可改，提交时全量替换（位置需与正文里的 @名字 一致）
    let mentionsChanged = false;
    let nextMentions: CommentMentionInput[] = [];
    if (mentions !== undefined) {
      if (comment.authorId !== user.id) {
        const err = errorResponse("只有作者可以编辑评论", 403);
        return NextResponse.json(err.response, { status: err.status });
      }

      // 同时改正文时按新正文校验位置，只改提及时按已存正文校验
      const mentioned = await validateMentions(
        mentions,
        comment.projectId,
        trimmedContent ?? comment.content
      );
      if ("error" in mentioned) {
        const err = errorResponse(mentioned.error.message, mentioned.error.status);
        return NextResponse.json(err.response, { status: err.status });
      }

      nextMentions = mentioned.mentions;
      const currentKeys = comment.mentions.map(mentionKey).sort();
      const nextKeys = nextMentions.map(mentionKey).sort();
      mentionsChanged =
        currentKeys.length !== nextKeys.length ||
        currentKeys.some((key, index) => key !== nextKeys[index]);
    }

    // 无实际变化：返回当前评论，不写活动记录也不广播
    if (Object.keys(data).length === 0 && !mentionsChanged) {
      const current = await prisma.comment.findUnique({
        where: { id: commentId },
        include: COMMENT_INCLUDE,
      });
      return NextResponse.json(successResponse(current));
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 提及全量替换：先清空再按新位置写入（同一事务内，避免中途失败留下半套数据）
      if (mentionsChanged) {
        await tx.commentMention.deleteMany({ where: { commentId } });
        if (nextMentions.length > 0) {
          await tx.commentMention.createMany({
            data: nextMentions.map(({ userId, start, end }) => ({
              commentId,
              userId,
              start,
              end,
            })),
          });
        }
      }

      const result = await tx.comment.update({
        where: { id: commentId },
        data,
        include: COMMENT_INCLUDE,
      });

      if (resolvedChanged && comment.projectId) {
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

    // 独立任务评论没有项目 SSE 频道，不广播
    if (comment.projectId) {
      broadcast(comment.projectId, "comment:updated", updated);
    }

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
      },
    });

    if (!comment) {
      const err = errorResponse("评论不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const scope = commentScopeOf(comment);
    if (!scope) {
      const err = errorResponse("评论作用域异常", 500);
      return NextResponse.json(err.response, { status: err.status });
    }

    const access = await checkCommentScopeAccess(scope, user.id);
    if (!access.ok) {
      const err = errorResponse(access.message, access.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 删除权限：作者本人，或作用域内的管理者（项目 ADMIN / 项目 owner / 独立任务创建者）
    const canDelete = comment.authorId === user.id || access.canModerate;

    if (!canDelete) {
      const err = errorResponse("无权删除该评论", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });

      // 活动记录挂在项目上：独立任务没有项目，跳过
      if (comment.projectId) {
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
      }
    });

    if (comment.projectId) {
      broadcast(comment.projectId, "comment:deleted", {
        commentId,
        cardId: comment.cardId,
        projectId: comment.projectId,
      });
    }

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
