import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { MEMBER_SELECT } from "@/lib/project-utils";
import { successResponse, errorResponse } from "@/types/api";

export async function GET() {
  try {
    const user = await requireAuth();

    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: {
            owner: { select: { id: true, name: true, image: true } },
            members: {
              select: MEMBER_SELECT,
              orderBy: { joinedAt: "asc" },
            },
          },
        },
      },
    });

    const projects = memberships
      .map((m) => ({
        id: m.project.id,
        name: m.project.name,
        description: m.project.description,
        role: m.role,
        ownerId: m.project.ownerId,
        owner: m.project.owner,
        members: m.project.members,
        createdAt: m.project.createdAt,
        updatedAt: m.project.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json(successResponse(projects));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取项目列表失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!name || name.trim().length === 0) {
      const err = errorResponse("项目名称不能为空");
      return NextResponse.json(err.response, { status: err.status });
    }

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          ownerId: user.id,
        },
      });

      await tx.projectMember.create({
        data: {
          userId: user.id,
          projectId: newProject.id,
          role: "ADMIN",
        },
      });

      return tx.project.findUniqueOrThrow({
        where: { id: newProject.id },
        include: {
          owner: { select: { id: true, name: true, image: true } },
          members: {
            select: MEMBER_SELECT,
            orderBy: { joinedAt: "asc" },
          },
          _count: { select: { activities: true } },
        },
      });
    });

    return NextResponse.json(successResponse({
      ...project,
      role: "ADMIN" as const,
      activityCount: project._count.activities,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("创建项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
