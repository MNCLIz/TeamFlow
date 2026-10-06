# 实时协作任务看板

> 基于 Next.js 16 的多人实时协作项目管理与任务追踪应用：固定四列看板、拖拽排序、SSE 实时同步、WebSocket（Yjs）协作文档、评论与 @提及、阿里云私有 OSS 图片存储。

![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [常用脚本](#常用脚本)
- [API 一览](#api-一览)
- [数据库设计](#数据库设计)
- [实时事件](#实时事件)
- [图片存储](#图片存储)
- [测试与质量检查](#测试与质量检查)
- [生产构建与部署](#生产构建与部署)
- [开发规范](#开发规范)
- [相关文档](#相关文档)

## 项目简介

多人协作的项目管理与任务追踪工具。用户可以创建项目、按邮箱邀请成员，在固定四列看板上管理任务卡片（未开始 / 接下来 / 进行中 / 已完成），并通过 SSE 让所有在线成员的界面实时同步；项目描述基于 Milkdown + Yjs 支持多人同时在线编辑 Markdown，评论系统支持引用回复与 @提及成员。

## 功能特性

**已实现：**

- **看板**：固定四列（`TaskState`：TODO / UP_NEXT / IN_PROGRESS / DONE），卡片增删改、拖拽排序与跨栏移动，SSE 实时同步，卡片详情抽屉
- **项目与成员**：项目列表 / 创建 / 更新 / 删除，按邮箱邀请成员、成员列表、主动退出项目
- **角色权限**：owner（唯一可删除项目、不可退出）/ ADMIN（可更新项目、管理成员）/ MEMBER（只读交互）
- **项目详情**：Linear 风格详情页 + Milkdown Markdown 描述编辑器 + 描述导入 / 导出 `.md`
- **协作文档**：项目描述的多人实时编辑（WebSocket + Yjs/Hocuspocus），带在线成员 presence 与服务端只读策略
- **评论系统**：卡片级评论 + 项目级讨论 + 无项目的独立任务评论，引用回复（一层）、解决 / 取消解决、编辑与删除权限、@提及成员、未读水位线
- **首页工作台**：问候区、四张概览统计卡、我的任务、最近项目、动态流（只展示他人操作）
- **全部任务页**：跨项目任务列表
- **图片**：粘贴 / 拖拽上传到阿里云私有 OSS，经鉴权代理读取
- **登录**：NextAuth.js v5（GitHub OAuth），JWT 会话策略

**规划中：**

- 动态流的实时推送（当前进入首页拉取一次）
- 在线用户展示（待后端广播 presence 事件后重建）
- 评论的提及通知（@我 聚合视图）
- 细粒度权限控制（当前为 owner / ADMIN / MEMBER 粗粒度区分）
- 首页未读讨论提示、其余页面骨架屏
- 卡片描述接入协作编辑（权限分支已预留）

### 页面结构

| 路径 | 说明 |
| --- | --- |
| `/` | 首页工作台（登录后）：概览统计、我的任务、最近项目、动态 |
| `/projects` | 项目列表页，支持创建项目 |
| `/projects/[id]` | 项目页：`Details`（详情 + 描述编辑 + 成员）与 `Tasks`（看板）两个页签 |
| `/tasks` | 全部任务页（跨项目） |
| `/login` | 登录页（GitHub OAuth + 开发环境测试登录） |

## 技术栈

| 分层 | 技术 | 说明 |
| --- | --- | --- |
| 框架 | Next.js 16（App Router）+ React 19 | 页面与 API Routes 同仓 |
| 语言 | TypeScript 5 | 严格模式，`@/` 路径别名 |
| UI | Tailwind CSS 4 + shadcn/ui + lucide-react | 组件位于 `components/ui`、`components/shared` |
| 状态管理 | Zustand | 数据获取集中在 Store 与 `lib/api` |
| 拖拽 | @dnd-kit | 看板卡片排序与跨栏移动 |
| Markdown | Milkdown 7 + ProseMirror | 项目 / 任务描述编辑器 |
| 实时通知 | Server-Sent Events（SSE） | 看板、成员、评论的实时同步，30s 心跳 |
| 协同正文 | WebSocket + Yjs + Hocuspocus | 项目描述多人在线编辑 |
| 认证 | NextAuth.js v5 (Auth.js) | GitHub OAuth（+ 开发环境 Credentials 测试登录），JWT 会话 |
| 数据库 | MySQL 8 + Prisma ORM 7 | `@prisma/adapter-mariadb` 驱动适配器 |
| 对象存储 | 阿里云 OSS（ali-oss） | 私有 Bucket，服务端鉴权代理读取 |

## 系统架构

两条实时通道职责分离：

- **SSE（通知）**：客户端订阅 `GET /api/projects/{id}/events`，服务端在有变更时广播事件；乐观更新失败会回滚并提示。连接的注册表挂在 `globalThis`（`lib/sse-registry.ts`），以便自定义服务器与 Route Handler 跨 bundle 共享。
- **WebSocket（正文）**：浏览器连接 `ws://<host>:<port>/collab/<documentName>`，由 `server.ts` 中继到仅监听回环地址的 Hocuspocus 端口；握手时从 Cookie 解析会话并判定权限，MEMBER 由服务端强制只读。

`npm run dev` / `npm start` 启动的都是 `server.ts` 自定义服务器，**同一个端口**同时承载 Next 请求与 `/collab/*` 的 WebSocket 握手。

## 目录结构

```
app/
├── api/                    # API Routes（projects / cards / comments / activities / docs / upload / image / auth）
├── home/                   # 首页分节组件与骨架屏
├── projects/               # 项目列表页 + 项目页（[id]/Details、[id]/Tasks）
├── tasks/                  # 全部任务页
├── login/                  # 登录页
├── layout.tsx / page.tsx   # 根布局与首页入口
components/
├── providers/              # Auth / Session Provider
├── shared/                 # Sidebar、CardDetail、Comments、MdEditor、Skeletons 等复用组件
└── ui/                     # shadcn/ui 基础组件
hooks/                      # useRealtime、useComments、useCommentReadState 等
lib/                        # prisma、auth、oss、sse、collab/、api/ 与纯逻辑工具
store/                      # Zustand：board / project / comment / commentRead / activity / userData
types/                      # 共享类型（api / board / project / comment / activity / user）
prisma/schema.prisma        # 数据模型
server.ts                   # 自定义服务器：Next handler + /collab/* WebSocket 中继
proxy.ts                    # 路由保护（Next.js 16 以 proxy.ts 取代 middleware.ts）
prisma7.config.ts           # Prisma 7 配置（从环境变量注入 datasource url）
apifox.openapi.json         # OpenAPI 3.0 接口文档（与代码同步维护）
```

## 环境要求

- **Node.js ≥ 20.9**（Next.js 16 要求）
- **MySQL 8**（需手动创建空数据库）
- **npm**（仓库使用 `package-lock.json`）
- 可选：GitHub OAuth App（登录）、阿里云 OSS 私有 Bucket（图片功能）

## 快速开始

### 1. 安装依赖

```bash
git clone <仓库地址>
cd <项目目录>
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`（`.env*` 已在 `.gitignore` 中忽略，不会提交到版本控制）：

```dotenv
# 数据库
DATABASE_URL="mysql://root:password@localhost:3306/task_board"

# NextAuth.js v5（AUTH_SECRET 可用 npx auth secret 生成）
AUTH_SECRET="<随机字符串>"
AUTH_GITHUB_ID="<GitHub OAuth App Client ID>"
AUTH_GITHUB_SECRET="<GitHub OAuth App Client Secret>"

# 应用地址
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# 阿里云 OSS（私有 Bucket）
OSS_REGION="oss-cn-beijing"
OSS_BUCKET="<bucket 名称>"
OSS_ACCESS_KEY_ID="<AccessKey ID>"
OSS_ACCESS_KEY_SECRET="<AccessKey Secret>"
```

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | MySQL 连接串；Prisma 7 通过 `prisma7.config.ts` 读取 |
| `AUTH_SECRET` | 是 | NextAuth 会话加密密钥 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 是 | GitHub OAuth App 凭据，回调地址填 `http://localhost:3000/api/auth/callback/github` |
| `NEXT_PUBLIC_APP_URL` | 是 | 应用对外地址（服务端组件内部请求使用） |
| `OSS_REGION` / `OSS_BUCKET` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | 图片功能必填 | 私有 Bucket 凭据 |
| `PORT` | 否 | 应用端口，默认 `3000` |
| `HOSTNAME` | 否 | 监听地址，默认 `localhost` |
| `COLLAB_PORT` | 否 | 协作服务内网端口（仅回环监听），默认 `PORT + 1` |
| `SERVER_URL` | 否 | 覆盖服务端内部请求地址（换端口 / 多实例时使用） |
| `COLLAB_BUNDLER` | 否 | 设为 `webpack` 可在 Turbopack 异常时回退 webpack |
| `DIST_DIR` | 否 | 更换构建输出目录，避免占用正在运行的 dev server 的 `.next` |

### 3. 初始化数据库

先手动创建空数据库（字符集建议 `utf8mb4`）：

```sql
CREATE DATABASE task_board DEFAULT CHARACTER SET utf8mb4;
```

再生成 Prisma Client 并同步表结构：

```bash
npm run db:generate   # 生成 Prisma Client 到 app/generated/prisma
npm run db:push       # 按 prisma/schema.prisma 同步表结构
```

> 仓库当前未启用 `prisma/migrations` 目录，日常以 `db:push` 同步表结构；`db:migrate` 为后续切换到迁移工作流时备用。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。`npm run dev` 走 `server.ts`，同一端口同时提供页面、API 与协作 WebSocket；`npm run dev:next` 只启动 Next（无协作通道），仅在排查问题时作为退路。

### 5. 登录

登录页支持 GitHub OAuth。开发环境（`NODE_ENV=development`）额外提供**测试登录**：直接从 `users` 表中已有的用户里选择登录，无需密码。首次使用可先用 GitHub 登录一次以创建用户记录。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式（自定义服务器：Next + `/collab/*` WebSocket） |
| `npm run dev:next` | 仅启动 Next 开发服务器（不含协作通道） |
| `npm run build` | 生产构建 |
| `npm start` | 启动自定义服务器（生产运行需 `NODE_ENV=production`） |
| `npm run lint` | ESLint 检查 |
| `npm run typecheck` | TypeScript 类型检查（`tsc --noEmit`） |
| `npm run collab:smoke` | 协作通道验收脚本（自建服务器 + 造数 + 协议场景） |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 同步表结构到数据库 |
| `npm run db:migrate` | 创建并应用开发迁移 |
| `npm run db:studio` | 打开 Prisma Studio |

## API 一览

所有接口基于 Cookie 会话（NextAuth）鉴权，统一响应格式：

```json
{ "success": true, "data": {} }
{ "success": false, "error": "错误信息" }
```

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/api/projects` | 项目列表（含角色与成员）/ 创建项目 |
| GET / PATCH / DELETE | `/api/projects/{id}` | 项目详情 / 更新 / 删除（仅 owner） |
| POST | `/api/projects/{id}/cards` | 在项目内创建卡片 |
| GET | `/api/projects/{id}/columns` | 看板列数据（固定 4 列，按 `order` 升序） |
| GET / POST / DELETE | `/api/projects/{id}/members` | 成员列表 / 按邮箱添加 / 移除（仅 ADMIN） |
| POST | `/api/projects/{id}/leave` | 退出项目（owner 不可退出） |
| GET | `/api/projects/{id}/events` | SSE 实时事件流（30s 心跳） |
| POST | `/api/projects/{id}/comments/read` | 标记项目级讨论已读（推进未读水位线） |
| POST | `/api/cards` | 创建卡片（可不属于任何项目） |
| PATCH / DELETE | `/api/cards/{id}` | 更新 / 删除卡片 |
| POST | `/api/cards/{id}/move` | 移动卡片（跨状态 / 排序） |
| GET | `/api/comments` | 评论列表（`?cardId=` 或 `?projectId=` 二选一） |
| POST | `/api/comments` | 创建评论（可选 `parentId` 引用、`mentions` 提及） |
| PATCH / DELETE | `/api/comments/{id}` | 更新（正文 / 解决状态 / 提及）/ 删除 |
| GET | `/api/activities` | 动态流（`?limit=` 1–50，默认 20） |
| GET | `/api/docs/{docName}` | 协作文档初始状态（编辑器挂载引导） |
| POST | `/api/upload/image` | 上传图片至私有 OSS（≤ 5MB） |
| GET | `/api/image` | 图片代理读取（`?key=uploads/...`） |
| GET / POST | `/api/auth/[...nextauth]` | NextAuth 认证端点 |

完整字段、请求体与状态码见根目录 [`apifox.openapi.json`](./apifox.openapi.json)（OpenAPI 3.0，v2.0.0，随代码同步维护），可直接导入 Apifox / Postman。`docs/apifox-api-docs.json` 为早期导出（v1.0.0），仅供对照。

## 数据库设计

Prisma 模型（`prisma/schema.prisma`）：

| 模型 | 说明 |
| --- | --- |
| `User` / `Account` / `Session` / `VerificationToken` | NextAuth 认证相关 |
| `Project` | 项目，`ownerId` 指向 owner |
| `ProjectMember` | 项目成员与角色（`ADMIN` / `MEMBER`），含项目级讨论未读水位线 |
| `Card` | 任务卡片：标题、描述、优先级、截止日期、负责人、`state`、`order`、`projectId`（可为 `null`，即无项目的独立任务） |
| `Document` | 协作文档：Yjs 快照（`yjsState` / `stateVector`）、`markdown` 投影、`version` |
| `Activity` | 项目活动记录（动态流数据源，卡片删除后 `cardId` 置空） |
| `Comment` / `CommentMention` | 评论与 @提及（含引用快照、解决状态） |

关键约定：

- **看板列不是数据库模型**：卡片状态使用固定的 `TaskState` 枚举（TODO / UP_NEXT / IN_PROGRESS / DONE），列顺序由前端常量定义。
- **排序使用 `Float` 类型的 `order` 字段**，支持小数间隔插入，避免整体重排。
- `priority` 与成员 `role` 以字符串字段存储；描述为 MySQL `TEXT`，超过 65535 字节时**只截断写回投影列**，`Document.markdown` 与 Yjs 快照保持完整。

## 实时事件

SSE 连接 `GET /api/projects/{id}/events` 后先收到 `connected`，此后按变更广播：

| 事件 | `data` | 说明 |
| --- | --- | --- |
| `connected` | `{ userId }` | 连接建立 |
| `card:created` / `card:updated` / `card:deleted` | 卡片对象 | 卡片增删改 |
| `card:moved` | `{ cardId, fromState, toState, order }` | 跨栏移动 / 排序 |
| `member:added` | 成员对象 | 添加成员 |
| `member:removed` | `{ userId }` | 移除成员或成员自行退出 |
| `comment:created` / `comment:updated` | 评论对象（含 `mentions`） | 评论变更 |
| `comment:deleted` | `{ commentId, cardId, projectId }` | 删除评论 |
| `doc:updated` | `{ kind, id, documentName, version, updatedAt, markdown, online }` | 协作文档快照落库 |

协作文档通道：浏览器连接 `ws://<host>:<port>/collab/<documentName>`，`documentName` 形如 `project-<projectId>`（卡片为 `card-<cardId>`，当前未开放）。握手携带 NextAuth 会话 Cookie，服务端按角色强制只读（MEMBER 可同步、不可写入）。验收脚本：`npm run collab:smoke`。

## 图片存储

- 上传：`POST /api/upload/image`（multipart，单文件 ≤ 5MB，仅 png / jpeg / gif / webp），对象 key 为 `uploads/` 前缀 + UUID
- 读取：`GET /api/image?key=...`，鉴权后由服务端从私有 OSS 流式代理返回，仅允许 `uploads/` 前缀且拒绝 `..`
- Markdown 中保存站内相对 URL（`/api/image?key=...`），对象 key 不可变，响应带长期缓存头

## 测试与质量检查

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript 类型检查
npm run build       # 构建检查
```

- **API 自动化测试**：基于 Playwright `APIRequestContext`，测试中自铸 JWT 会话 Cookie、直接用原生 mariadb 操作数据库。测试文件位于 `tests/`（已在 `.gitignore` 中忽略，不随仓库分发）。
- **协作通道验收**：`npm run collab:smoke`。
- **注意事项**：不要在正在运行的 dev server 所使用的 `.next` 上执行 `next build` —— 构建会清理其 `@prisma/*` 副本，导致后续所有鉴权且触库的接口 500。需要验证构建时请用 `DIST_DIR` 指定其它输出目录，或先停掉 dev server。

## 生产构建与部署

```bash
npm run build

# 生产运行（server.ts 以 NODE_ENV 判定 dev/production）
NODE_ENV=production npm start
# Windows PowerShell: $env:NODE_ENV="production"; npm start
```

- **必须常驻 Node 进程**：`server.ts` 同时承载 Next 请求与协作 WebSocket，纯静态托管不可用；协作服务另需一个仅监听回环地址的内部端口（`COLLAB_PORT`）。
- 生产环境不启用测试登录（仅 `NODE_ENV=development` 时注册 Credentials 提供方）。
- 部署前同步生产环境变量，并把 GitHub OAuth 回调地址改为线上域名（`https://<域名>/api/auth/callback/github`）。

## 开发规范

- 使用 TypeScript，禁止无意义的 `any`；组件 PascalCase、函数与变量 camelCase
- 统一使用 `@/` 别名导入，禁止 `../../../` 深层相对路径
- 客户端组件与 Store 禁止引入依赖 Prisma 的模块（否则构建会把 `fs` 打进浏览器包）；纯常量 / 纯函数请放在客户端安全模块
- 全局状态用 Zustand，组件只订阅所需状态；复杂逻辑抽离为自定义 Hook
- API 路由必须做权限校验，敏感操作（删除、移动卡片）使用事务保证原子性
- **修改后端 API 必须同步更新 `apifox.openapi.json`**
- 遵循 Conventional Commits（`feat` / `fix` / `refactor` / `perf` / `docs` / `test` / `chore`），description 使用中文；**不要自动提交代码**
- 提交前完成 `lint` / `typecheck` / `build` 三项检查

## 相关文档

以下文档记录了更详细的设计、规划与踩坑记录，仅保留在本地开发环境（已加入 `.gitignore`，不随仓库分发）：

| 文档 | 内容 |
| --- | --- |
| `AGENTS.md` | 工程规范与 AI 协作约定（目录结构、编码约定、状态与 API 规则、当前项目状态） |
| `PROJECT_PLAN.md` | 项目规划：技术选型、功能模块、数据库设计 |
| `DEVELOPMENT_WORKFLOW.md` | 分阶段开发工作流程与实现细节 |
| `WEBSOCKET_COLLAB_DESIGN.md` | 协作文档通道的改造设计与实施记录 |
