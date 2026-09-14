# AGENTS.md

## Project Overview

实时协作任务看板应用，支持多人实时协作的项目管理与任务追踪。

**核心价值**: 展示全栈开发能力（Next.js + SSE + 数据库 + 实时通信）

### 页面结构

项目看板页面包含三个子页面 + 右侧固定面板：

- **Overview**: 仿 Linear 风格的项目详情页，展示图标、标题、属性、附件、描述
- **Tasks**: 主功能页面，多栏目看板（待处理/进行中/待审核等），支持卡片 CRUD、拖拽排序/跨栏移动、实时同步
- **Activity**: 团队动态流，展示任务发布和操作记录
- **右侧固定面板**: 项目信息概览 + 邀请成员入口（所有子页面共享）

### 功能优先级

**P0（核心功能）:**
- Tasks 页面：多栏目、卡片 CRUD（标题/描述/负责人/优先级/deadline/标签/内容/附件）、拖拽排序与跨栏移动、SSE 实时同步
- Overview 页面：Linear 风格项目详情
- Activity 页面：操作动态流
- 右侧固定项目信息面板 + 邀请成员入口

**P1（后续开发）:**
- 表情/文字评论系统
- 细粒度权限控制
- 邀请成员具体实现方式

## Tech Stack

### 前端
- **框架**: Next.js 15 (App Router)
- **UI库**: Tailwind CSS + shadcn/ui
- **状态管理**: Zustand
- **拖拽**: @dnd-kit/core
- **实时通信**: Server-Sent Events (SSE) / WebSocket
- **类型检查**: TypeScript

### 后端
- **API路由**: Next.js API Routes
- **认证**: NextAuth.js v5 (Auth.js)
- **数据库**: MySQL + Prisma ORM
- **实时推送**: SSE + Pusher fallback

## Directory Structure

```
app/
├── api/                    # API Routes
│   ├── auth/              # NextAuth 认证
│   ├── projects/          # 项目管理 API
│   │   ├── route.ts       # GET 列表 / POST 创建
│   │   └── [id]/
│   │       ├── route.ts   # GET 详情 / PATCH 更新 / DELETE 删除
│   │       ├── cards/     # POST 创建卡片
│   │       ├── columns/   # GET 看板列数据
│   │       ├── events/    # GET SSE 实时事件流
│   │       └── members/   # GET 列表 / POST 添加 / DELETE 移除
│   └── cards/             # 卡片管理 API
│       └── [id]/
│           ├── route.ts   # PATCH 更新 / DELETE 删除
│           └── move/      # POST 移动卡片
├── projects/              # 项目页面
│   ├── page.tsx           # 项目列表页
│   └── [id]/             # 看板页面（布局容器 + 右侧固定面板）
│       ├── layout.tsx     # 看板布局（含右侧项目信息面板）
│       ├── overview/      # Overview 子页面（Linear 风格项目详情）
│       │   └── page.tsx
│       ├── tasks/         # Tasks 子页面（看板主功能）
│       │   └── page.tsx
│       └── activity/      # Activity 子页面（团队动态流）
│           └── page.tsx
├── login/                 # 登录页面
├── layout.tsx             # 根布局
└── page.tsx               # 首页

middleware.ts              # 路由保护（页面重定向/API 401）

components/
├── board/                 # 看板组件
│   ├── Board.tsx          # 看板容器
│   ├── Column.tsx         # 栏目组件
│   ├── Card.tsx           # 卡片组件
│   └── CardDetailModal.tsx # 卡片详情弹窗
├── project/               # 项目相关组件
│   ├── ProjectSidebar.tsx # 右侧固定项目信息面板
│   ├── ProjectOverview.tsx # Overview 页面内容
│   └── ActivityFeed.tsx   # Activity 动态流
├── ui/                    # shadcn/ui 组件
└── shared/                # 共享组件
    ├── Header.tsx
    └── OnlineUsers.tsx

lib/
├── prisma.ts              # Prisma 客户端
├── auth.ts                # NextAuth 配置
├── auth-utils.ts          # 认证/授权工具函数
└── sse.ts                 # SSE 连接管理与广播

hooks/
├── useProject.ts          # 项目相关 Hook
└── useRealtime.ts         # 实时订阅 Hook

store/
└── boardStore.ts          # Zustand 状态管理

prisma/
└── schema.prisma          # 数据库模型

types/
├── api.ts                 # API 类型定义
├── board.ts               # 看板类型定义
└── auth.ts                # 认证类型定义
```

## Coding Conventions

- 使用 TypeScript，禁止无意义的 any
- 使用函数组件和 React Server Components（优先）
- 组件使用 PascalCase，函数和变量使用 camelCase
- 优先复用已有代码，不要进行与当前任务无关的重构
- 遵循 Next.js 15 App Router 最佳实践

## Import Rules

- 使用 @ 别名导入（如 `@/components/board/Card`）
- 禁止使用 ../../../ 等深层相对路径
- 优先使用绝对路径导入

## React Rules

- 优先使用 React Server Components，仅在需要交互时使用 Client Components
- 不要滥用 useEffect，优先考虑事件驱动
- 不要滥用 useMemo/useCallback，除非有明确性能问题
- 全局状态使用 Zustand，组件只订阅需要的状态
- 复杂逻辑抽离为自定义 Hook
- 使用 'use client' 指令标记客户端组件

## State Management

- 使用 Zustand 管理全局状态（看板数据、在线用户等）
- Store 放在 `store/` 目录
- 简单的局部状态使用 useState
- 避免不必要的全局状态
- 实现乐观更新时注意回滚逻辑

## API Rules

- 所有 API 请求统一放在 `app/api/` 目录
- 使用统一的错误响应格式
- API 路由必须进行权限校验
- 敏感操作（删除、移动卡片）必须验证用户权限
- 卡片移动等关键操作使用数据库事务保证原子性

## Real-time Collaboration

- 使用 SSE 实现实时同步
- 实现心跳检测机制防止连接静默断开
- 乐观更新失败时必须回滚并提示用户
- 在线用户状态通过 SSE 广播
- 考虑浏览器不支持 SSE 时的降级方案

## Database

- 使用 Prisma ORM 操作 MySQL 数据库
- 所有 Schema 变更必须更新 `prisma/schema.prisma`
- 执行迁移前运行 `npx prisma generate`
- 复合查询使用 @@index 优化性能
- 卡片排序使用 Float 类型支持小数间隔

## Authentication & Authorization

- 使用 NextAuth.js v5 (Auth.js) 实现 OAuth 登录
- 所有受保护的路由必须进行会话验证
- 项目成员权限分为 ADMIN 和 MEMBER
- 只能访问有权限的项目和数据

## Error Handling

- 统一 API 错误响应格式
- 前端捕获错误后显示友好提示
- 关键操作失败提供重试机制
- 记录错误日志便于排查问题

## Testing

修改代码后运行：

```bash
npm run lint        # ESLint 检查
npm run typecheck   # TypeScript 类型检查
npm run build       # 构建检查
```

## Git

使用 Conventional Commits：

```
feat: 新增功能
fix: 修复问题
refactor: 重构
perf: 性能优化
docs: 文档
test: 测试
chore: 工程配置
```

description 使用中文。

**不要自动提交代码**。只有用户明确要求时才执行 git commit，且必须使用 auto-git-commit skill。

## Development Principles

1. 修改前先理解现有代码
2. 优先复用已有实现
3. 保持修改范围最小
4. 不修改与任务无关的代码
5. 修改完成后进行验证
6. 如果发现潜在问题，可以向用户说明，但不要擅自扩大修改范围
7. 涉及数据库操作必须考虑事务性和并发安全
8. 实时协作功能必须处理网络异常和冲突

## Workflow

采用逐端点推进的开发模式，每次只完成一个 API 端点或功能单元：

1. 理解当前端点/功能的需求
2. 阅读相关现有代码
3. 实现代码（API + 类型 + 必要的前端调用）
4. 运行 `npm run typecheck` 确认类型正确
5. 运行 `npm run build` 确认构建通过
6. 调用 `@api-testing` skill 对刚完成的接口进行自动化测试，确保测试通过
7. 向用户报告完成情况，等待"继续"指令
8. 收到"继续"后进入下一个端点/功能

**禁止一次性实现多个端点后再验证。** 每完成一个端点必须立即验证。

## Current Project Status

### Completed (Phase 1: Initialization)

- ✅ 核心依赖安装完成（prisma@7, next-auth@5, zustand, @dnd-kit/core, bcryptjs）
- ✅ 环境变量配置（.env.local）
- ✅ Prisma Schema 定义并验证通过（User/Account/Session/Project/Column/Card/Label/Attachment/Activity/ProjectMember）
- ✅ Prisma 7 驱动适配器配置（@prisma/adapter-mariadb）
- ✅ NextAuth v5 配置（GitHub OAuth + 数据库会话 + PrismaAdapter）
- ✅ 项目目录结构创建完成
- ✅ shadcn/ui 初始化（base-nova 风格）及组件安装（button/dialog/input/textarea/badge/dropdown-menu）
- ✅ 类型系统定义（api.ts/board.ts/auth.ts）
- ✅ Zustand Store 实现（boardStore.ts）
- ✅ SSE 实时通信工具（sse.ts）
- ✅ 自定义 Hooks（useRealtime.ts/useProject.ts）
- ✅ 看板组件实现（Board/Column/Card/CardDetailModal）
- ✅ 共享组件实现（Header/OnlineUsers）
- ✅ 页面实现（首页/登录/项目列表/看板页面）

### Completed (Phase 2: Backend API + Realtime)

- ✅ `GET /api/projects/[id]/columns` — 获取看板列数据（含卡片、标签、附件）
- ✅ `POST /api/cards/[id]/move` — 移动卡片（跨栏 + 排序 + 活动记录）
- ✅ `POST /api/projects/[id]/cards` — 创建卡片（支持 assigneeId/content/labelIds）
- ✅ `PATCH /api/cards/[id]` — 更新卡片（支持 assigneeId/content/labelIds）
- ✅ `DELETE /api/cards/[id]` — 删除卡片
- ✅ `GET /api/projects` — 获取当前用户参与的项目列表
- ✅ `POST /api/projects` — 创建项目（自动创建默认列 + ADMIN 成员）
- ✅ `GET /api/projects/[id]` — 获取项目详情
- ✅ `PATCH /api/projects/[id]` — 更新项目（ADMIN 权限）
- ✅ `DELETE /api/projects/[id]` — 删除项目（ADMIN 权限）
- ✅ `GET /api/projects/[id]/events` — SSE 实时事件流（心跳 + 连接管理）
- ✅ `middleware.ts` — 路由保护（页面重定向 /login，API 返回 401）
- ✅ SSE broadcast 集成 — 所有写入 API 推送实时事件（card:created/moved/updated/deleted, member:added/removed）
- ✅ Schema 扩展 — Card 完整支持 assigneeId/content/labels/attachments
- ✅ `GET /api/projects/[id]/members` — 获取项目成员列表
- ✅ `POST /api/projects/[id]/members` — 添加成员（ADMIN 权限）
- ✅ `DELETE /api/projects/[id]/members` — 移除成员（ADMIN 权限）
- ✅ 认证/授权工具函数（lib/auth-utils.ts）
- ✅ 类型检查和构建检查全部通过

### Pending

- ⏳ 用户需填写 .env.local 中的真实值（GitHub OAuth 凭据、MySQL 密码）
- ⏳ 执行 `npm run db:push` 同步数据库
- ⏳ Phase 3 (P1): 评论系统、细粒度权限控制、邀请成员具体实现
- ⏳ 前端重构：看板页面三子页面（Overview/Tasks/Activity）+ 右侧固定面板
- ⏳ 前端对接后端 API（替换 RSC 直查为客户端 fetch + SSE 实时更新）

## Work Rules

- 未完成类型检查，不得认为任务完成
- 未完成构建检查，不得认为任务完成
- 修改代码前先阅读相关代码
- 不要修改与当前任务无关的文件
- 遇到不确定问题，先分析现有代码，再决定方案
- 涉及敏感文件（.env、密钥等）不得提交到版本控制
- 测试文件不提交到版本控制，需在 .gitignore 中忽略
