import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { errorResponse } from "@/types/api";
import { ossClient } from "@/lib/oss";

// 仅允许代理 uploads/ 前缀下的对象，防止越权读取 bucket 内其他文件
const ALLOWED_PREFIX = "uploads/";

// bucket 私有，由本站用凭据从 OSS 读取图片并流式返回；markdown 存本站相对 url
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const key = request.nextUrl.searchParams.get("key");
    if (!key || !key.startsWith(ALLOWED_PREFIX) || key.includes("..")) {
      const err = errorResponse("无效的图片 key");
      return NextResponse.json(err.response, { status: err.status });
    }

    const result = await ossClient.get(key);
    const headers = result.res.headers as Record<string, string>;
    const contentType = headers["content-type"] || "application/octet-stream";

    return new NextResponse(result.content as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // 对象 key 为不可变 UUID，可长期缓存
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    // OSS 对象不存在
    const status = (error as { status?: number }).status;
    if (status === 404) {
      const err = errorResponse("图片不存在", 404);
      return NextResponse.json(err.response, { status: err.status });
    }
    console.error("图片读取失败:", error);
    const err = errorResponse("图片读取失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
