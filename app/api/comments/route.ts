import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";
import {
  buildQuotedExcerpt,
  checkCommentScopeAccess,
  COMMENT_EXCERPT_LENGTH,
  COMMENT_INCLUDE,
  resolveCommentScope,
  validateCommentContent,
  validateMentions,
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

    const scope = resolved.scope;

    const access = await checkCommentScopeAccess(scope, user.id);
    if (!access.ok) {
      const err = errorResponse(access.message, access.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 项目级讨论、项目内卡片评论与独立任务评论共用此端点：
    // projectId 为 null 时即独立任务评论（cardId 必填）
    const comments = await prisma.comment.findMany({
      where: { projectId: scope.projectId, cardId: scope.cardId },
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
    const { content, cardId, projectId, parentId, mentions } = body as {
      content?: unknown;
      cardId?: unknown;
      projectId?: unknown;
      parentId?: unknown;
      mentions?: unknown;
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
    if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
      const err = errorResponse("参数 parentId 类型错误");
      return NextResponse.json(err.response, { status: err.status });
    }

    const resolved = await resolveCommentScope(cardId ?? null, projectId ?? null);
    if ("error" in resolved) {
      const err = errorResponse(resolved.error.message, resolved.error.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    const scope = resolved.scope;

    const access = await checkCommentScopeAccess(scope, user.id);
    if (!access.ok) {
      const err = errorResponse(access.message, access.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 提及成员：必须是本项目成员，且位置要与正文里的 @名字 对得上，写入 comment_mentions
    // 独立任务（scope.projectId 为 null）没有成员可提及，传 mentions 直接 400
    const mentioned = await validateMentions(
      mentions,
      scope.projectId,
      validated.content
    );
    if ("error" in mentioned) {
      const err = errorResponse(mentioned.error.message, mentioned.error.status);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 引用（回复）：只允许一层，parentId 统一指向根评论，并写入引用快照
    let quoted: {
      parentId: string;
      quotedAuthorName: string | null;
      quotedExcerpt: string;
    } | null = null;

    if (parentId) {
      const parentSelect = {
        id: true,
        projectId: true,
        cardId: true,
        parentId: true,
        content: true,
        author: { select: { name: true, email: true } },
      } as const;

      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: parentSelect,
      });

      if (!parent) {
        const err = errorResponse("被引用的评论不存在", 404);
        return NextResponse.json(err.response, { status: err.status });
      }

      // 卡片评论与项目级讨论不能互相引用
      if (parent.projectId !== scope.projectId || parent.cardId !== scope.cardId) {
        const err = errorResponse("只能引用同一作用域内的评论");
        return NextResponse.json(err.response, { status: err.status });
      }

      // 回复"某条回复"时，引用目标提升为它的根评论，保证引用只有一层
      const root = parent.parentId
        ? ((await prisma.comment.findUnique({
            where: { id: parent.parentId },
            select: parentSelect,
          })) ?? parent)
        : parent;

      quoted = {
        parentId: root.id,
        quotedAuthorName: root.author?.name ?? root.author?.email ?? null,
        quotedExcerpt: buildQuotedExcerpt(root.content),
      };
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          content: validated.content,
          projectId: scope.projectId,
          cardId: scope.cardId,
          authorId: user.id,
          parentId: quoted?.parentId ?? null,
          quotedAuthorName: quoted?.quotedAuthorName ?? null,
          quotedExcerpt: quoted?.quotedExcerpt ?? null,
          mentions: {
            create: mentioned.mentions.map(({ userId, start, end }) => ({
              userId,
              start,
              end,
            })),
          },
        },
        include: COMMENT_INCLUDE,
      });

      // 活动记录挂在项目上：独立任务没有项目，跳过（与卡片 CRUD 的处理一致）
      if (scope.projectId) {
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
              parentId: quoted?.parentId ?? null,
              // 提及成员去重后记录（同一个人被 @ 多次只记一次 id），位置明细在 comment_mentions
              mentionIds: Array.from(new Set(mentioned.mentions.map((m) => m.userId))),
            }),
          },
        });
      }

      return created;
    });

    // 独立任务没有项目 SSE 频道，不广播（实时同步只覆盖项目内数据）
    if (scope.projectId) {
      broadcast(scope.projectId, "comment:created", comment);
    }

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
