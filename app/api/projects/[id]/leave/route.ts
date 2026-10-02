import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { broadcast } from "@/lib/sse";

// 退出项目：成员主动移除自己，owner 不能退出（只能删除项目）
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const err = errorResponse("项目不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    if (project.ownerId === user.id) {
      const err = errorResponse("项目所有者不能退出项目，请直接删除项目", 403);
      return NextResponse.json(err.response, { status: err.status });
    }

    const member = await checkProjectAccess(projectId, user.id);
    if (!member) {
      const err = errorResponse("您不是该项目成员", 404);
      return NextResponse.json(err.response, { status: err.status });
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectMember.delete({
        where: { userId_projectId: { userId: user.id, projectId } },
      });

      await tx.activity.create({
        data: {
          projectId,
          userId: user.id,
          action: "REMOVE_MEMBER",
          details: JSON.stringify({ removedUserId: user.id, self: true }),
        },
      });
    });

    broadcast(projectId, "member:removed", { userId: user.id });

    return NextResponse.json(successResponse({ left: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("退出项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
