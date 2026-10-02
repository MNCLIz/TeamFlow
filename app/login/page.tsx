import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LoginPage() {
  const isDev = process.env.NODE_ENV === "development";
  // 开发环境查出全部用户供测试登录下拉选择；生产构建时 isDev 恒为 false，不触发查询
  const users = isDev
    ? await prisma.user.findMany({
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-6">Sign in to TaskBoard</h1>
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Sign in with GitHub
          </button>
        </form>

        {/* 测试登录入口：仅开发环境渲染，从数据库已有用户中直接选择登录 */}
        {isDev && (
          <form
            className="mt-6 pt-6 border-t border-gray-200 text-left space-y-3"
            action={async (formData: FormData) => {
              "use server";
              try {
                await signIn("credentials", {
                  userId: formData.get("userId"),
                  redirectTo: "/",
                });
              } catch (error) {
                // signIn 成功时也通过抛 NEXT_REDIRECT 实现跳转，必须原样放行；
                // 只有认证失败（CredentialsSignin / AccessDenied）才回登录页提示错误
                if (
                  error instanceof Error &&
                  (error.name === "CredentialsSignin" || error.name === "AccessDenied")
                ) {
                  redirect("/login?error=invalid");
                }
                throw error;
              }
            }}
          >
            <p className="text-sm font-medium text-gray-500 text-center">测试登录（仅开发环境）</p>
            <select
              name="userId"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? "未命名"}（{user.email}）
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              以选中用户登录
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
