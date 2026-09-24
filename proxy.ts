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

  console.log("Proxy:", pathname);

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

// Next.js 只识别根目录的 middleware.ts；本文件命名为 proxy.ts 不会被自动加载，
// 需在 middleware.ts 中 re-export，或直接将本文件改名为 middleware.ts 才能生效。
export const config = {
  matcher: ["/projects/:path*", "/api/projects/:path*", "/api/cards/:path*"],
};
