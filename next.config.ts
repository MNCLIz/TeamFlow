import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ali-oss 依赖 urllib 惰性 require 可选的 proxy-agent，需外置避免打包时静态解析报错
  serverExternalPackages: ["@prisma/client", "ali-oss"],
  // 允许换一个 distDir 起第二个实例（用户 dev server 占用 .next 时的验证用）
  ...(process.env.DIST_DIR ? { distDir: process.env.DIST_DIR } : {}),
};

export default nextConfig;
