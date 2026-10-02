import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/types/api";
import { ossClient } from "@/lib/oss";

// 允许的图片类型 → OSS Content-Type
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

// 大小上限 5MB
const MAX_SIZE = 5 * 1024 * 1024;

// 扩展名映射，未知类型统一用 .png 兜底不影响正确性（Content-Type 已显式设置）
const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const err = errorResponse("未提供文件字段 file");
      return NextResponse.json(err.response, { status: err.status });
    }

    const contentType = file.type;
    if (!ALLOWED_TYPES[contentType]) {
      const err = errorResponse("不支持的文件类型，仅允许 png/jpeg/gif/webp");
      return NextResponse.json(err.response, { status: err.status });
    }

    if (file.size > MAX_SIZE) {
      const err = errorResponse("文件过大，最大 5MB");
      return NextResponse.json(err.response, { status: err.status });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // uploads/yyyy/mm/uuid.ext —— 随机文件名防覆盖与路径注入
    const now = new Date();
    const dir = `uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
    const key = `${dir}/${randomUUID()}.${EXT_MAP[contentType] ?? "png"}`;

    await ossClient.put(key, buffer, {
      headers: { "Content-Type": ALLOWED_TYPES[contentType] },
    });

    // bucket 私有，返回本站代理 url（相对路径，跨环境可移植），前端 markdown 直接存此 url
    const url = `/api/image?key=${encodeURIComponent(key)}`;
    return NextResponse.json(successResponse({ url, key }), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      const err = errorResponse("未登录", 401);
      return NextResponse.json(err.response, { status: err.status });
    }
    console.error("图片上传失败:", error);
    const err = errorResponse("图片上传失败", 500);
    return NextResponse.json(err.response, { status: err.status });
  }
}
