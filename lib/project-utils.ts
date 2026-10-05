// 项目成员的对外字段定义（服务端使用；不依赖 Prisma 运行时，只是 Prisma select 常量）
//
// 为什么要显式 select：`include` 会把 project_members 的所有标量字段都带出来，
// 其中 lastReadAt 是「本人对项目级讨论的已读水位线」，只应通过 GET /api/projects/{id}
// 的顶层字段下发给请求者自己，不能随成员列表泄露给其他成员。

// 成员列表（项目列表 / 项目详情用，与既有响应保持一致：user 不含 email）
export const MEMBER_SELECT = {
  id: true,
  userId: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

// 成员列表（成员管理端点用：user 含 email，便于按邮箱展示/邀请）
export const MEMBER_SELECT_WITH_EMAIL = {
  ...MEMBER_SELECT,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;
