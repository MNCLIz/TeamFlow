# AGENTS.md

## Project Overview

实时协作任务看板应用（类似 Trello 简化版），支持多人实时协作的任务管理。

**核心价值**: 展示全栈开发能力（Next.js + WebSocket + 数据库 + 实时通信）

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
│   └── cards/             # 卡片管理 API
├── projects/              # 项目页面
│   └── [id]/             # 看板页面
├── login/                 # 登录页面
├── layout.tsx             # 根布局
└── page.tsx               # 首页

components/
├── board/                 # 看板组件
│   ├── Board.tsx
│   ├── Column.tsx
│   ├── Card.tsx
│   └── CardDetailModal.tsx
├── ui/                    # shadcn/ui 组件
└── shared/                # 共享组件
    ├── Header.tsx
    └── OnlineUsers.tsx

lib/
├── prisma.ts              # Prisma 客户端
├── auth.ts                # NextAuth 配置
└── sse.ts                 # SSE 工具

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

执行任何开发任务时，必须按照以下流程：

1. 理解需求
2. 检查项目结构
3. 制定实施方案
4. 实现代码
5. 运行类型检查
6. 运行构建检查
7. 检查 Git diff
8. 总结修改内容

## Work Rules

- 未完成类型检查，不得认为任务完成
- 未完成构建检查，不得认为任务完成
- 修改代码前先阅读相关代码
- 不要修改与当前任务无关的文件
- 遇到不确定问题，先分析现有代码，再决定方案
- 涉及敏感文件（.env、密钥等）不得提交到版本控制
- 测试文件不提交到版本控制，需在 .gitignore 中忽略
