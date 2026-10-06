import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
} from "node:http";
import type { Duplex } from "node:stream";
import type { Server as HocuspocusServer } from "@hocuspocus/server";

/**
 * 自定义服务器：同一个端口同时承载
 *   - Next 的 HTTP 请求（由 Next 自己的 handler 处理）
 *   - /collab/* 的 WebSocket 握手（中继到内网 Hocuspocus 端口）
 *
 * 为什么不把 Hocuspocus 挂到本 server 上：@hocuspocus/server 的 Server 自带 http server 与
 * crossws 适配层，直接共用需要我们伪造它内部的 Request 对象；用回环中继则完全不依赖它的内部 API
 * （HTTP/1.1 的 Upgrade 就是一次可转发的握手）。鉴权所需 cookie 在握手里，原样带着转发。
 *
 * 与 Next 共存的前提（已在 next@16.3.5 源码确认）：Next 自己的 upgrade 处理器对没有匹配到
 * 任何路由的 upgrade 请求不做处理、也不关闭 socket（router-server.js 中 "we don't handle the
 * request as user's custom WS server may be listening on the same path"），因此 /collab 能落到这里，
 * 而 /_next/hmr 仍然由 Next 处理。
 *
 * 启动方式：package.json 的 dev / start 都是 `tsx server.ts`（见设计文档 §3.2）。
 */

const COLLAB_PATH = "/collab";

/** 把 /collab/* 的握手原样中继到内网协作端口 */
function relayUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  collabHost: string,
  collabPort: number,
) {
  const upstream = httpRequest({
    host: collabHost,
    port: collabPort,
    method: req.method,
    path: req.url,
    headers: req.headers,
  });

  upstream.on("upgrade", (res, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(res.headers)
      .flatMap(([key, value]) =>
        Array.isArray(value)
          ? value.map((item) => `${key}: ${item}`)
          : [`${key}: ${value}`],
      )
      .join("\r\n");

    socket.write(
      `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n${headers}\r\n\r\n`,
    );
    if (upstreamHead?.length) socket.write(upstreamHead);
    if (head?.length) upstreamSocket.write(head);

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);

    const cleanup = () => {
      upstreamSocket.destroy();
      socket.destroy();
    };
    socket.on("error", cleanup);
    upstreamSocket.on("error", cleanup);
  });

  upstream.on("error", (error) => {
    console.error("[collab] 中继到协作服务失败：", error.message);
    socket.destroy();
  });

  upstream.end();
}

async function start() {
  const { loadEnvConfig } = await import("@next/env");

  // 自定义服务器不是 Next CLI 启动的，环境变量要自己加载（AUTH_SECRET / DATABASE_URL 等）
  loadEnvConfig(process.cwd());

  const [{ default: next }, { Server: Hocuspocus }, { collabHooks }, { openSseRegistry }] =
    await Promise.all([
      import("next"),
      import("@hocuspocus/server"),
      import("@/lib/collab/server-hooks"),
      import("@/lib/sse-registry"),
    ]);

  const dev = process.env.NODE_ENV !== "production";
  const port = Number(process.env.PORT ?? 3000);
  const hostname = process.env.HOSTNAME ?? "localhost";
  // 协作 WS 服务器只监听内网回环：浏览器永远连的是本服务器的 /collab（见 relayUpgrade）
  const collabPort = Number(process.env.COLLAB_PORT ?? port + 1);
  const collabHost = "127.0.0.1";

  // 服务端组件内部 fetch 用 lib/request.ts 的 NEXT_PUBLIC_APP_URL（.env.local 里通常写 3000）。
  // 换了端口启动时它必须指向自己，否则内部请求会打到别的实例、拿到 HTML 错误页导致 JSON 解析失败。
  // 仅在本进程内覆盖，不写回 .env.local。
  process.env.NEXT_PUBLIC_APP_URL =
    process.env.SERVER_URL ?? `http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`;

  // 与 Route Handler 共享同一份 SSE 注册表（详见 lib/sse-registry.ts）
  openSseRegistry();

  const hocuspocus: HocuspocusServer = new Hocuspocus({
    port: collabPort,
    address: collabHost,
    quiet: true,
    ...collabHooks,
  });
  await hocuspocus.listen();

  // 允许指定打包器（Next 16 默认 turbopack；某些环境下 turbopack 处理 CSS 会产出坏内容，
  // 此时可用 COLLAB_BUNDLER=webpack 退回 webpack）。普通启动不需要设置。
  const bundler = process.env.COLLAB_BUNDLER;
  const app = next({
    dev,
    hostname,
    port,
    ...(bundler ? { turbopack: bundler !== "webpack" } : {}),
  });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => handle(req, res));

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith(COLLAB_PATH)) return; // 其余 upgrade（HMR）交给 Next
    console.log("[collab] WS 握手:", req.url);
    relayUpgrade(req, socket, head, collabHost, collabPort);
  });

  server.listen(port, () => {
    console.log(`\n  ▲ Next.js ${dev ? "(dev)" : "(production)"} + 协作服务`);
    console.log(`  - 应用:     http://${hostname}:${port}`);
    console.log(`  - 协作 WS:  ws://${hostname}:${port}${COLLAB_PATH}/<documentName>`);
    console.log(`  - 内网端口: ${collabHost}:${collabPort}（不对外）\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[collab] 收到 ${signal}，正在关闭…`);
    await hocuspocus.destroy().catch(() => {});
    server.close(() => process.exit(0));
    // 兜底：连接未释放时也退出
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

// tsx 以 CJS 转译本文件，顶层 await 不可用，因此包一层
start().catch((error) => {
  console.error("[collab] 服务器启动失败：", error);
  process.exit(1);
});
