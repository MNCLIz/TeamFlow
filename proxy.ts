import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// 白名单：无需登录即可访问的路径前缀
const PUBLIC_PATHS = ["/", "/login", "/api/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // JWT 策略下从 cookie 解析会话，无需查库，可在 Edge Runtime 运行
  const session = await auth();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      // API 未登录返回 401 JSON；fetch 跟随重定向会拿到 HTML，无法处理
      return NextResponse.json(
        { success: false, error: { message: "未登录", code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    // 页面未登录：带 callbackUrl 跳转，登录后回跳原页
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Next.js 16 起中间件文件约定为根目录的 proxy.ts（middleware.ts 仍被识别但已弃用，
// 构建时会打印迁移警告），导出的函数名必须是 proxy 才会被加载。
// matcher 覆盖所有需要登录的页面与 API；未列入的 API（如 /api/upload、/api/image）
// 由各自的 requireAuth 返回 401 兜底。
export const config = {
  matcher: [
    "/projects/:path*",
    "/tasks/:path*",
    "/api/projects/:path*",
    "/api/cards/:path*",
  ],
};
