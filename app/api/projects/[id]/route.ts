import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess, requireProjectAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { MEMBER_SELECT } from "@/lib/project-utils";
import { successResponse, errorResponse } from "@/types/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const member = await checkProjectAccess(id, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, image: true } },
        members: {
          select: MEMBER_SELECT,
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!project) {
      const err = errorResponse("项目不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    // 打开项目时的「未读起点」：项目级讨论里第一条我没读过的未解决评论
    // 判定与前端红点一致（晚于本人水位线、未解决、不是自己发的），但以本次请求为准做快照，
    // 之后面板展开把水位线推进也不会让分割线跳走
    const firstUnread = await prisma.comment.findFirst({
      where: {
        projectId: id,
        cardId: null,
        resolved: false,
        authorId: { not: user.id },
        ...(member.lastReadAt ? { createdAt: { gt: member.lastReadAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return NextResponse.json(successResponse({
      ...project,
      role: member.role,
      activityCount: project._count.activities,
      // 当前请求者自己的讨论已读水位线（不放进 members，避免泄露他人的已读时间）
      lastReadAt: member.lastReadAt,
      firstUnreadCommentId: firstUnread?.id ?? null,
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取项目详情失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    await requireProjectAdmin(id, user.id);

    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (name === undefined && description === undefined) {
      const err = errorResponse("没有提供需要更新的字段");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (name !== undefined && name.trim().length === 0) {
      const err = errorResponse("项目名称不能为空");
      return NextResponse.json(err.response, { status: err.status });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;

    const updated = await prisma.project.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true, image: true } },
        members: {
          select: MEMBER_SELECT,
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { activities: true } },
      },
    });

    const member = await checkProjectAccess(id, user.id);

    return NextResponse.json(successResponse({
      ...updated,
      role: member?.role,
      activityCount: updated._count.activities,
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      const err = errorResponse("仅管理员可修改项目信息", 403);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("更新项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // 仅项目所有者可删除项目
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      const err = errorResponse("项目不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (project.ownerId !== user.id) {
      const err = errorResponse("仅项目所有者可删除项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      const err = errorResponse("仅项目所有者可删除项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("删除项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
