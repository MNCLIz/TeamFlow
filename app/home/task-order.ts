import { CardType, TaskState } from "@/types/board";

/**
 * 首页「概览统计」与「我的任务」共用的时间 / 排序口径。
 * 纯函数，客户端可安全引用（不依赖 Prisma）。
 *
 * 口径说明（与 CardDetail 的逾期判定保持一致）：
 * - 逾期：截止日期早于今天 0 点（当天到期不算逾期，算「今天到期」）
 * - 我的未完成任务：分配给我（assigneeId === 我）且未完成，含独立任务（projectId 为 null）
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// dueDate 经 JSON 序列化后是 ISO 字符串（不是 Date），统一转时间戳；缺失或非法返回 null
export function dueTime(card: CardType): number | null {
  if (!card.dueDate) return null;
  const time = new Date(card.dueDate).getTime();
  return Number.isNaN(time) ? null : time;
}

export function startOfToday(now: Date = new Date()): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export function isOverdue(card: CardType, now: Date = new Date()): boolean {
  const time = dueTime(card);
  return time !== null && time < startOfToday(now);
}

export function isDueToday(card: CardType, now: Date = new Date()): boolean {
  const time = dueTime(card);
  if (time === null) return false;
  const start = startOfToday(now);
  return time >= start && time < start + DAY_MS;
}

export function isMyOpenTask(card: CardType, userId: string): boolean {
  return (
    Boolean(userId) &&
    card.assigneeId === userId &&
    card.state !== TaskState.Done
  );
}

const PRIORITY_WEIGHT: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

// 排序：逾期 → 今天到期 → 未来到期 → 无截止日期；
// 同档内依次按截止日期升序、优先级、最近更新
export function sortMyTasks(cards: CardType[], now: Date = new Date()): CardType[] {
  const start = startOfToday(now);
  const end = start + DAY_MS;

  const dueRank = (card: CardType) => {
    const time = dueTime(card);
    if (time === null) return 3;
    if (time < start) return 0;
    if (time < end) return 1;
    return 2;
  };

  return [...cards].sort((a, b) => {
    const rankDiff = dueRank(a) - dueRank(b);
    if (rankDiff !== 0) return rankDiff;

    const timeA = dueTime(a);
    const timeB = dueTime(b);
    if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;

    const priorityDiff =
      (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
