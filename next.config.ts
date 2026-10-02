import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ali-oss 依赖 urllib 惰性 require 可选的 proxy-agent，需外置避免打包时静态解析报错
  serverExternalPackages: ["@prisma/client", "ali-oss"],
};

export default nextConfig;
