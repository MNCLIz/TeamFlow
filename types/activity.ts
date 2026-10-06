import { TaskState } from "@/types/board";

/**
 * 项目活动（Activity 表）的动作类型。
 * 与 app/api/ 各写入点的 action 字符串一一对应，新增写入点时两边都要改。
 *
 * 注意：记录只挂在项目上（Activity.projectId 非空）。独立任务（projectId 为 null 的卡片）
 * 与其评论不写活动记录，因此不会出现在动态流里。
 */
export enum ActivityAction {
  CreateCard = "CREATE_CARD",
  UpdateCard = "UPDATE_CARD",
  MoveCard = "MOVE_CARD",
  DeleteCard = "DELETE_CARD",
  AddComment = "ADD_COMMENT",
  ResolveComment = "RESOLVE_COMMENT",
  DeleteComment = "DELETE_COMMENT",
  AddMember = "ADD_MEMBER",
  RemoveMember = "REMOVE_MEMBER",
}

/**
 * `Activity.details` 是按 action 变化的 JSON（各写入点 JSON.stringify 的形状）：
 * - CREATE_CARD / DELETE_CARD → { title }
 * - UPDATE_CARD → string[]（变更的字段名，是数组不是对象）
 * - MOVE_CARD → { fromState, toState }
 * - ADD_COMMENT → { commentId, scope, excerpt, parentId, mentionIds }
 * - RESOLVE_COMMENT → { commentId, resolved }
 * - DELETE_COMMENT → { commentId, scope, excerpt }
 * - ADD_MEMBER → { addedUserId, role }
 * - REMOVE_MEMBER → { removedUserId, self? }
 *
 * 因此这里只描述「反序列化后的两种形态」，取值统一走 lib/activity.ts 的读取函数，
 * 不要在使用处直接断言具体字段（历史数据的形状可能与当前写入点不一致）。
 */
export type ActivityDetails = Record<string, unknown> | string[] | null;

export interface ActivityUserType {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ActivityProjectType {
  id: string;
  name: string;
}

export interface ActivityCardType {
  id: string;
  title: string;
  state: TaskState;
}

/**
 * 动态流条目。
 * `card` 在任务被删除后为 null（Activity.cardId 是 SetNull），此时标题回退到 details.title。
 */
export interface ActivityType {
  id: string;
  action: ActivityAction;
  details: ActivityDetails;
  createdAt: Date | string;
  user: ActivityUserType;
  project: ActivityProjectType;
  card: ActivityCardType | null;
}
