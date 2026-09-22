import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess, requireProjectAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
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
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!project) {
      const err = errorResponse("项目不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    return NextResponse.json(successResponse({
      ...project,
      role: member.role,
      activityCount: project._count.activities,
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

    const project = await prisma.project.update({
      where: { id },
      data,
    });

    return NextResponse.json(successResponse(project));
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

    await requireProjectAdmin(id, user.id);

    await prisma.project.delete({ where: { id } });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      const err = errorResponse("仅管理员可删除项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("删除项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
