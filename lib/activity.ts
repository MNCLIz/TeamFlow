import {
  ActivityAction,
  type ActivityDetails,
  type ActivityType,
} from "@/types/activity";
import { TASK_STATE_LABELS, TaskState } from "@/types/board";

/**
 * 动态流的纯逻辑（客户端可安全引用，禁止在此引入 Prisma 依赖）：
 * details 读取、条目文案、相对时间、接口 limit 口径。
 * 展示组件只负责排版，规则集中在这里。
 */

/** 一次最多返回多少条（接口上限，避免客户端要一个超大 limit 把整表捞出来） */
export const ACTIVITY_MAX_LIMIT = 50;
/** 未传 limit 时的默认条数 */
export const ACTIVITY_DEFAULT_LIMIT = 20;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * 解析 `?limit=`：未传（或空字符串）取默认值，其余必须是 1..ACTIVITY_MAX_LIMIT 的整数。
 * 口径放在这里而不是写在路由里，方便与测试共用同一份规则。
 */
export function parseActivityLimit(
  raw: string | null,
): { limit: number } | { error: string } {
  if (raw === null || raw === "") return { limit: ACTIVITY_DEFAULT_LIMIT };

  const message = `limit 必须是 1-${ACTIVITY_MAX_LIMIT} 的整数`;
  if (!/^\d+$/.test(raw)) return { error: message };

  const limit = Number(raw);
  if (limit < 1 || limit > ACTIVITY_MAX_LIMIT) return { error: message };

  return { limit };
}

/**
 * 反序列化 Activity.details。
 * 坏数据（非法 JSON、JSON 标量）返回 null 而不是抛错 —— 一条脏记录不该让整个动态流 500。
 * 数组形态会过滤掉非字符串与空串（`["title", 1, ""]` → `["title"]`），
 * 因此 `[]` 这类「合法但无内容」的值会返回空数组而不是 null，
 * 效果同样是不显示变更字段（见 describeActivity），不影响渲染。
 */
export function parseActivityDetails(raw: string | null): ActivityDetails {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      );
    }
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

// details 为对象时取字段（UPDATE_CARD 的数组形态统一在这里挡掉）
function detailOf(details: ActivityDetails): Record<string, unknown> | null {
  return details && !Array.isArray(details) ? details : null;
}

function detailString(details: ActivityDetails, key: string): string | null {
  const value = detailOf(details)?.[key];
  return typeof value === "string" && value ? value : null;
}

/** CREATE_CARD / DELETE_CARD 记录的任务标题（任务删除后 card 关系为 null，靠它兜底） */
export function activityTitle(details: ActivityDetails): string | null {
  return detailString(details, "title");
}

/** 评论摘要（ADD_COMMENT / DELETE_COMMENT 写入时截断过） */
export function activityExcerpt(details: ActivityDetails): string | null {
  return detailString(details, "excerpt");
}

/** UPDATE_CARD 记录的变更字段名 */
export function activityFieldNames(details: ActivityDetails): string[] {
  return Array.isArray(details) ? details : [];
}

/** 评论作用域：CARD（卡片评论）/ PROJECT（项目级讨论） */
export function activityCommentScope(
  details: ActivityDetails,
): "CARD" | "PROJECT" | null {
  const scope = detailString(details, "scope");
  return scope === "CARD" || scope === "PROJECT" ? scope : null;
}

/** MOVE_CARD 记录的状态流转 */
export function activityStateChange(
  details: ActivityDetails,
): { fromState: string | null; toState: string | null } | null {
  const value = detailOf(details);
  if (!value || !("fromState" in value) || !("toState" in value)) return null;

  return {
    fromState: detailString(details, "fromState"),
    toState: detailString(details, "toState"),
  };
}

// 变更字段 → 中文标签；未知字段（将来新增）原样回显，而不是把信息丢掉
const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  description: "描述",
  priority: "优先级",
  dueDate: "截止日期",
  assigneeId: "负责人",
  state: "状态",
};

export function activityFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function stateLabel(state: string | null, fallback: string): string {
  if (state === null) return fallback;
  return TASK_STATE_LABELS[state as TaskState] ?? state;
}

export interface ActivitySentence {
  /** 动作短语，如「更新了任务」（渲染在人名之后） */
  verb: string;
  /** 动作对象（任务标题等），渲染成「…」；没有具体对象时为 null */
  target: string | null;
  /** 第二行的补充信息（变更字段 / 评论摘要 / 状态流转） */
  detail: string | null;
}

/**
 * 条目文案。只产出纯文本片段（不含 JSX），人名、项目名与时间由组件另行渲染。
 * 未知 action 落到兜底文案：历史数据里的新动作不该渲染成空白行。
 */
export function describeActivity(activity: ActivityType): ActivitySentence {
  const { details } = activity;
  // 任务标题优先取关系字段（实时），删除记录回退到 details 里的标题快照
  const cardTitle = activity.card?.title ?? activityTitle(details);

  switch (activity.action) {
    case ActivityAction.CreateCard:
      return { verb: "创建了任务", target: cardTitle, detail: null };

    case ActivityAction.DeleteCard:
      return { verb: "删除了任务", target: cardTitle, detail: null };

    case ActivityAction.UpdateCard: {
      const fields = activityFieldNames(details).map(activityFieldLabel);
      return {
        verb: "更新了任务",
        target: cardTitle,
        detail: fields.length > 0 ? `变更 ${fields.join("、")}` : null,
      };
    }

    case ActivityAction.MoveCard: {
      const change = activityStateChange(details);
      return {
        verb: "移动了任务",
        target: cardTitle,
        detail: change
          ? `${stateLabel(change.fromState, "未知状态")} → ${stateLabel(
              change.toState,
              "未知状态",
            )}`
          : null,
      };
    }

    case ActivityAction.AddComment: {
      // scope 是写入时的快照；老数据没有该字段时用 card 关系判断
      const scope = activityCommentScope(details);
      const isCardComment = scope ? scope === "CARD" : activity.card !== null;
      return {
        verb: isCardComment ? "评论了任务" : "在项目讨论中发言",
        target: isCardComment ? cardTitle : null,
        detail: activityExcerpt(details),
      };
    }

    case ActivityAction.DeleteComment:
      return {
        verb: "删除了一条评论",
        target: null,
        detail: activityExcerpt(details),
      };

    case ActivityAction.ResolveComment:
      return {
        verb:
          detailOf(details)?.resolved === false
            ? "取消解决了讨论"
            : "解决了讨论",
        target: null,
        detail: null,
      };

    case ActivityAction.AddMember: {
      const role = detailString(details, "role");
      return {
        verb: "添加了成员",
        target: null,
        detail:
          role === "ADMIN" ? "角色 管理员" : role === "MEMBER" ? "角色 成员" : null,
      };
    }

    case ActivityAction.RemoveMember:
      return {
        verb: detailOf(details)?.self === true ? "退出了项目" : "移除了成员",
        target: null,
        detail: null,
      };

    default:
      return { verb: "更新了项目", target: null, detail: null };
  }
}

/**
 * 相对时间（动态流只显示「多久以前」，精确时间放在 title 里）。
 * 数据来自服务端，客户端渲染真实内容（首页 SSR 阶段只出骨架屏），不存在水合不一致。
 */
export function formatActivityTime(
  createdAt: Date | string,
  now: Date = new Date(),
): string {
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return "";

  const diff = now.getTime() - time;
  if (diff < MINUTE_MS) return "刚刚";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} 分钟前`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} 小时前`;

  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;

  return new Date(time).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
