import { prisma } from "@/lib/prisma";

/**
 * 从 WebSocket 握手的 Cookie 头解析 NextAuth 会话。
 *
 * 为什么不用 `auth()`：它读的是 Route Handler 的请求上下文（`next/headers`），
 * 而 WS 握手不经过 Route Handler，拿不到那个上下文。这里直接校验 JWT，
 * 与 NextAuth 的 JWT 会话策略（`lib/auth.ts` 的 `session: { strategy: "jwt" }`）等价。
 */

// NextAuth 在不同协议下的会话 Cookie 名（http 用前者，https 用后者）
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

export interface CollabUser {
  id: string;
  name: string | null;
  image: string | null;
}

/** 解析 Cookie 头为键值表（只取会话相关的那几个，避免解析无关 Cookie） */
function readSessionToken(cookieHeader: string | null): {
  token: string;
  cookieName: string;
} | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (!SESSION_COOKIE_NAMES.includes(name as (typeof SESSION_COOKIE_NAMES)[number])) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    if (!value) continue;

    return { token: decodeURIComponent(value), cookieName: name };
  }

  return null;
}

/**
 * Cookie 头 → 数据库中的用户；未登录 / 令牌非法 / 用户已删除均返回 null。
 * 调用方用 null 表示 401（拒绝建立连接）。
 */
export async function resolveUserFromCookie(
  cookieHeader: string | null,
): Promise<CollabUser | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error("[collab] 缺少 AUTH_SECRET，无法校验会话");
    return null;
  }

  const session = readSessionToken(cookieHeader);
  if (!session) return null;

  let payload: { id?: unknown; sub?: unknown } | null;
  try {
    // 动态导入：@auth/core/jwt 是纯 ESM，而自定义服务器经 tsx 以 CJS 转译
    const { decode } = await import("@auth/core/jwt");
    // salt 必须与签发时一致：NextAuth 用 Cookie 名作为 HKDF salt
    payload = (await decode({
      token: session.token,
      secret,
      salt: session.cookieName,
    })) as { id?: unknown; sub?: unknown } | null;
  } catch {
    return null;
  }
  if (!payload) return null;

  const userId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.sub === "string"
        ? payload.sub
        : null;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true },
  });

  return user;
}
