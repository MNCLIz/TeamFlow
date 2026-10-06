// 描述字段的长度约束：客户端（导入预校验）与服务端（PATCH 校验）共用同一上限，避免两边阈值漂移。
// Project.description / Card.description 都是 MySQL TEXT（65,535 字节），超限写入只会以 500 暴露，
// 所以两端都按 UTF-8 字节数拦截。纯常量 / 纯函数，客户端与服务端都可安全引用（禁止引入 Prisma）
export const MAX_DESCRIPTION_BYTES = 65535;

/** 按 UTF-8 字节数计算：中文 1 个字 = 3 字节，不能用 String.length 判断上限 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function isDescriptionWithinLimit(text: string): boolean {
  return utf8ByteLength(text) <= MAX_DESCRIPTION_BYTES;
}

/** 超限时的统一中文提示（服务端 400 与前端 toast 共用同一措辞） */
export function descriptionTooLongMessage(bytes: number): string {
  return `描述过长（UTF-8 字节数 ${bytes}，上限 ${MAX_DESCRIPTION_BYTES}）`;
}
