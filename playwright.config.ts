import { defineConfig } from "@playwright/test";

// 端口可用环境变量覆盖：协作相关的 spec 需要在自定义服务器（含 /collab 的 WS 中继）上跑，
// 而它可能不是 3000（例如用户自己的 dev server 正占着 3000）。
const PORT = process.env.PORT ?? "3000";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// 显式给了 E2E_BASE_URL 表示目标服务器已经在跑（例如协作专用实例），
// 此时不要再拉起 webServer：它继承 PORT 后会试图占用同一个端口。
const manageServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
  },
  webServer: manageServer
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120000,
      }
    : undefined,
});
