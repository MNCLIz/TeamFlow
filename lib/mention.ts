import type { MemberType } from "@/types/project";

// @提及的纯前端逻辑（客户端安全模块：禁止在此引入 Prisma）
// 位置语义与服务端严格一致：正文的 JS UTF-16 下标、左闭右开，content.slice(start, end) === "@" + name
// 因此"写进正文的名字"必须与后端 validateMentions 取的名字一致（user.name ?? user.email）

export interface MentionCandidate {
  userId: string;
  /** 写进正文的名字（后端校验用：user.name ?? user.email） */
  name: string;
  /** 面板里展示的名字（name 为空时退化为邮箱/占位） */
  label: string;
  email: string | null;
  image: string | null;
}

// 一次提及查询词的最大长度：超过就不再当作提及（避免把整段正文当成搜索词）
export const MENTION_QUERY_MAX_LENGTH = 30;

// @ 前一个字符属于这些字符时说明是邮箱/用户名的一部分，不触发提及面板
const WORD_CHAR = /[A-Za-z0-9._%+-]/;

export function mentionName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  return user.name ?? user.email ?? "";
}

export function mentionLabel(user: {
  name?: string | null;
  email?: string | null;
}): string {
  return user.name || user.email || "未知用户";
}

// 项目成员 → 提及候选：按 userId 去重、剔除没有可写名字的成员
export function toMentionCandidates(members: MemberType[]): MentionCandidate[] {
  const seen = new Set<string>();
  const result: MentionCandidate[] = [];
  for (const member of members) {
    const user = member?.user;
    if (!user || seen.has(member.userId)) continue;
    const name = mentionName(user);
    if (!name) continue;
    seen.add(member.userId);
    result.push({
      userId: member.userId,
      name,
      label: mentionLabel(user),
      email: user.email ?? null,
      image: user.image ?? null,
    });
  }
  return result;
}

// 拼音排序：zh-Hans-CN 在 ICU 里默认就按拼音排序（显式带上 collation: "pinyin" 作为提示，
// 不支持该变体的运行时会忽略它、退回该语言环境的默认排序，这里做兜底 try/catch）
// 注意：zh 的排序规则下汉字整体排在拉丁字母之前（李四/张三 → Bob Liu → MNCLI）
function createCollator(): Intl.Collator {
  try {
    return new Intl.Collator("zh-Hans-CN", {
      collation: "pinyin",
      sensitivity: "base",
      numeric: true,
    });
  } catch {
    return new Intl.Collator("zh-Hans-CN", { sensitivity: "base", numeric: true });
  }
}

const collator = createCollator();

// 按拼音首字母顺序排序（同音/同名时用 userId 兜底，保证顺序稳定）
export function sortMentionCandidates(
  candidates: MentionCandidate[]
): MentionCandidate[] {
  return [...candidates].sort(
    (a, b) => collator.compare(a.label, b.label) || a.userId.localeCompare(b.userId)
  );
}

// 面板搜索：名字或邮箱包含查询词；前缀命中的排在前面，其余保持拼音序
export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string
): MentionCandidate[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return candidates;

  const prefix: MentionCandidate[] = [];
  const rest: MentionCandidate[] = [];
  for (const candidate of candidates) {
    const label = candidate.label.toLowerCase();
    const email = (candidate.email ?? "").toLowerCase();
    if (!label.includes(keyword) && !email.includes(keyword)) continue;
    (label.startsWith(keyword) ? prefix : rest).push(candidate);
  }
  return [...prefix, ...rest];
}

export interface MentionQuery {
  /** 正文里 "@" 的下标 */
  start: number;
  /** 查询词结束位置（光标处） */
  end: number;
  /** "@" 与光标之间的查询词 */
  query: string;
}

// 解析光标处的 @ 上下文：命中返回 "@"+查询词 的范围，否则返回 null（面板关闭）
export function getMentionQuery(text: string, caret: number): MentionQuery | null {
  if (caret <= 0 || caret > text.length) return null;

  const start = text.lastIndexOf("@", caret - 1);
  if (start === -1) return null;

  const prev = start === 0 ? "" : text[start - 1];
  if (prev && WORD_CHAR.test(prev)) return null;

  const query = text.slice(start + 1, caret);
  if (query.length > MENTION_QUERY_MAX_LENGTH) return null;
  // 空白或第二个 @ 都表示这次提及已经结束
  if (query.includes("@") || /\s/.test(query)) return null;

  return { start, end: caret, query };
}

// 把选中的成员写进正文：替换 "@"+查询词，并在名字后补一个空格（便于继续输入，同时关闭面板）
export function insertMention(
  text: string,
  range: { start: number; end: number },
  name: string
): { text: string; caret: number } {
  const inserted = `@${name} `;
  const before = text.slice(0, range.start);
  const after = text.slice(range.end);
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

// 渲染用的正文片段：mention 为 true 时是被 @ 的成员
export interface MentionSegment {
  text: string;
  userId?: string;
}

// 用数据库里的位置把正文切成 [普通文本, 提及] 片段（高亮渲染用）
// 位置与正文对不上时（例如正文被改过而提及没同步）直接跳过该段：宁可不亮，也不亮错位置
export function splitMentionSegments(
  content: string,
  mentions?: {
    userId: string;
    start: number;
    end: number;
    user?: { name?: string | null; email?: string | null } | null;
  }[]
): MentionSegment[] {
  if (!mentions || mentions.length === 0) return [{ text: content }];

  const spans = mentions
    .filter(
      (mention) =>
        Number.isInteger(mention.start) &&
        Number.isInteger(mention.end) &&
        mention.start >= 0 &&
        mention.end > mention.start &&
        mention.end <= content.length
    )
    .filter((mention) => {
      const text = content.slice(mention.start, mention.end);
      if (!text.startsWith("@")) return false;
      const name = mention.user ? mentionName(mention.user) : "";
      // 拿得到名字时要求完全一致，拿不到时只要求以 @ 开头
      return !name || text === `@${name}`;
    })
    .sort((a, b) => a.start - b.start);

  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // 重叠位置：保守跳过
    if (span.start > cursor) segments.push({ text: content.slice(cursor, span.start) });
    segments.push({ text: content.slice(span.start, span.end), userId: span.userId });
    cursor = span.end;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor) });
  return segments;
}

// 提交时按最终正文重算提及位置：
// - 在正文里找每个 "@"，用"最长名字优先"匹配候选成员，避免 李四 抢走 @李四四
// - 只保留用户在选择框里真正选过的成员
export function collectMentions(
  text: string,
  candidates: MentionCandidate[],
  pickedUserIds: Iterable<string>
): { userId: string; start: number; end: number }[] {
  const picked = new Set(pickedUserIds);
  if (picked.size === 0) return [];

  const byNameLength = [...candidates].sort((a, b) => b.name.length - a.name.length);
  const mentions: { userId: string; start: number; end: number }[] = [];

  for (let index = 0; index < text.length; index++) {
    if (text[index] !== "@") continue;

    const prev = index === 0 ? "" : text[index - 1];
    if (prev && WORD_CHAR.test(prev)) continue;

    const hit = byNameLength.find((candidate) =>
      text.startsWith(`@${candidate.name}`, index)
    );
    if (!hit) continue;

    index += hit.name.length;
    if (!picked.has(hit.userId)) continue;

    mentions.push({
      userId: hit.userId,
      start: index - hit.name.length,
      end: index + 1,
    });
  }

  return mentions;
}
