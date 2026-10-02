import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const providers: NextAuthConfig["providers"] = [GitHub];

// 测试登录仅开发环境可用：直接选择数据库中已有用户登录，无需密码
if (process.env.NODE_ENV === "development") {
  providers.push(
    Credentials({
      name: "测试登录",
      credentials: {
        userId: { label: "用户", type: "text" },
      },
      async authorize(credentials) {
        const userId = credentials?.userId as string | undefined;
        if (!userId) return null;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    })
  );
}

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma) as never,
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;
export const auth = nextAuth.auth;

