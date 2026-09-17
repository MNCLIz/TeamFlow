import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
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
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
              orderBy: { joinedAt: "asc" },
            },
            columns: {
              include: {
                cards: {
                  include: {
                    labels: true,
                    attachments: true,
                    assignee: { select: { id: true, name: true, image: true } },
                  },
                  orderBy: { order: "asc" },
                },
              },
              orderBy: { order: "asc" },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const projects = memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      description: m.project.description,
      role: m.role,
      ownerId: m.project.ownerId,
      owner: m.project.owner,
      members: m.project.members,
      columns: m.project.columns,
      createdAt: m.project.createdAt,
      updatedAt: m.project.updatedAt,
    }));

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

      const defaultColumns = [
        { name: "未开始", order: 0 },
        { name: "接下来", order: 1 },
        { name: "进行中", order: 2 },
        { name: "已完成", order: 3 },
      ];

      await tx.column.createMany({
        data: defaultColumns.map((col) => ({
          ...col,
          projectId: newProject.id,
        })),
      });

      return newProject;
    });

    return NextResponse.json(successResponse(project), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("创建项目失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
