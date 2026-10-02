import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess, requireProjectAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;

    const member = await checkProjectAccess(projectId, user.id);
    if (!member) {
      const err = errorResponse("无权访问该项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    const result = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }));

    return NextResponse.json(successResponse(result));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取成员列表失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;

    await requireProjectAdmin(projectId, user.id);

    const body = await request.json();
    const { email, role } = body as { email?: string; role?: string };

    if (!email) {
      const err = errorResponse("缺少必要参数 email");
      return NextResponse.json(err.response, { status: err.status });
    }

    const validRoles = ["ADMIN", "MEMBER"];
    const memberRole = role && validRoles.includes(role) ? role : "MEMBER";

    // 按邮箱查找目标用户，不存在则返回 404
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      const err = errorResponse("用户不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUser.id, projectId } },
    });
    if (existing) {
      const err = errorResponse("该用户已是项目成员");
      return NextResponse.json(err.response, { status: err.status });
    }

    const newMember = await prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.create({
        data: { userId: targetUser.id, projectId, role: memberRole },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: "ADD_MEMBER",
          details: JSON.stringify({ addedUserId: targetUser.id, role: memberRole }),
        },
      });

      return member;
    });

    broadcast(projectId, "member:added", newMember);

    return NextResponse.json(successResponse(newMember), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      const err = errorResponse("需要管理员权限", 403);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("添加成员失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      const err = errorResponse("缺少必要参数 userId");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (userId === user.id) {
      const err = errorResponse("不能移除自己，请使用退出项目功能");
      return NextResponse.json(err.response, { status: err.status });
    }

    await requireProjectAdmin(projectId, user.id);

    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!member) {
      const err = errorResponse("该用户不是项目成员", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({
        where: { userId_projectId: { userId, projectId } },
      });

      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: "REMOVE_MEMBER",
          details: JSON.stringify({ removedUserId: userId }),
        },
      });
    });

    broadcast(projectId, "member:removed", { userId });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      const err = errorResponse("需要管理员权限", 403);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("移除成员失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
