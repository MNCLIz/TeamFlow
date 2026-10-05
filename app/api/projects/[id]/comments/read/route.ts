import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/types/api";

// 标记项目级讨论已读：把当前成员的水位线推进到指定时间
// - 不传 lastReadAt：推进到最新一条评论的 createdAt（即"全部已读"）
// - 水位线只允许前进，且以最新一条评论的时间为上界（防止伪造未来时间把未读永久吞掉）
// - 幂等：值没变化时不写库
export async function POST(
  request: NextRequest,
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

    // 允许空 body（表示"标记全部已读"）
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const raw = (body as { lastReadAt?: unknown } | null)?.lastReadAt;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      const err = errorResponse("参数 lastReadAt 必须为时间字符串");
      return NextResponse.json(err.response, { status: err.status });
    }

    let incoming: Date | null = null;
    if (typeof raw === "string") {
      incoming = new Date(raw);
      if (Number.isNaN(incoming.getTime())) {
        const err = errorResponse("参数 lastReadAt 不是有效的时间");
        return NextResponse.json(err.response, { status: err.status });
      }
    }

    // 项目级讨论里最新的一条评论：作为水位线的上界
    const latest = await prisma.comment.findFirst({
      where: { projectId: id, cardId: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const bounded = latest
      ? incoming && incoming < latest.createdAt
        ? incoming
        : latest.createdAt
      : null;

    let next = member.lastReadAt;
    if (bounded && (!next || bounded > next)) next = bounded;

    if (next) {
      // 条件更新保证并发下水位线不会回退（单条 UPDATE，不需要事务）
      await prisma.projectMember.updateMany({
        where: {
          userId: user.id,
          projectId: id,
          OR: [{ lastReadAt: null }, { lastReadAt: { lt: next } }],
        },
        data: { lastReadAt: next },
      });
    }

    return NextResponse.json(successResponse({ lastReadAt: next ?? null }));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    console.error("[CommentRead] POST failed:", error);
    const err = errorResponse("标记已读失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
