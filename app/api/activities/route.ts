import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";
import { parseActivityDetails, parseActivityLimit } from "@/lib/activity";
import { ActivityAction } from "@/types/activity";

/**
 * GET /api/activities —— 我参与的项目里的动态流（首页「动态」区块用）
 *
 * - 可见范围：我是成员（ProjectMember）的全部项目的活动，按 `project.members` 过滤，
 *   包含我自己产生的记录（「只看别人的」由首页在展示层过滤，见 app/HomeClient.tsx）
 * - 排序：createdAt 倒序；同一毫秒用 id 兜底，保证分页/截断的结果稳定
 * - limit：1-50，默认 20；非法返回 400
 * - 独立任务（无项目）不产生活动记录，因此不会出现在这里
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const parsedLimit = parseActivityLimit(
      new URL(request.url).searchParams.get("limit"),
    );
    if ("error" in parsedLimit) {
      const err = errorResponse(parsedLimit.error);
      return NextResponse.json(err.response, { status: err.status });
    }

    const rows = await prisma.activity.findMany({
      where: { project: { members: { some: { userId: user.id } } } },
      include: {
        user: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, name: true } },
        card: { select: { id: true, title: true, state: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsedLimit.limit,
    });

    const activities = rows.map((row) => ({
      id: row.id,
      // action 在库里是 String 列，写入方都是 ActivityAction 的取值；
      // 未知值由 describeActivity 的兜底分支处理，不在这里过滤（避免旧数据整条消失）
      action: row.action as ActivityAction,
      details: parseActivityDetails(row.details),
      createdAt: row.createdAt,
      user: row.user,
      project: row.project,
      card: row.card,
    }));

    return NextResponse.json(successResponse(activities));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    const err = errorResponse("获取动态失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
