/**
 * 协作在线用户 / 远端光标的颜色。
 *
 * 由用户 id 派生，保证同一用户在所有端颜色一致（远端光标、在线头像、头像下方的名字条都用它）。
 * 纯函数，客户端安全（禁止引入任何依赖 Prisma 的模块）。
 */

/** 与 shadcn 主题色系协调的一组颜色；顺序固定，便于识别 */
const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#d97706",
  "#7c3aed",
  "#0891b2",
] as const;

export function collabColorOf(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index++) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 997;
  }
  return PALETTE[hash % PALETTE.length];
}
