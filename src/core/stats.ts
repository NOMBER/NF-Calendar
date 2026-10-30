/** Pure statistics helpers (word and task counting, monthly totals). */

export function getWordCount(text: string): number {
  // Letters/digits of any script (Unicode property escapes), CJK counted per char.
  const cjk = /[\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5]/gu;
  const cjkCount = (text.match(cjk) || []).length;
  const rest = text.replace(cjk, " ");
  const words = rest.match(/(?:[0-9]+(?:[.,][0-9]+)*|[\p{L}\p{M}\-'’])+/gu) || [];
  return words.filter((w) => /[\p{L}0-9]/u.test(w)).length + cjkCount;
}

export interface ITaskCount {
  done: number;
  open: number;
}

/**
 * Count markdown checkboxes: `- [ ]` open, `- [x]` / `- [X]` done.
 * Also accepts `*`, `+` and numbered lists, any indentation. Lines inside
 * fenced code blocks are ignored.
 */
export function countTasks(text: string): ITaskCount {
  let done = 0;
  let open = 0;
  let inFence = false;
  for (const line of (text || "").split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const m = /^\s*(?:[-*+]|\d+[.)])\s+\[(.)\]/.exec(line);
    if (!m) {
      continue;
    }
    if (m[1] === " ") {
      open++;
    } else if (m[1] === "x" || m[1] === "X") {
      done++;
    }
  }
  return { done, open };
}

/**
 * Count tasks from Obsidian's metadataCache list items
 * (`task` is " " for open, "x"/"X" for done, other chars = custom status).
 */
export function countTasksFromListItems(
  items: Array<{ task?: string }> | null | undefined,
): ITaskCount {
  let done = 0;
  let open = 0;
  for (const item of items || []) {
    if (item.task === undefined) {
      continue;
    }
    if (item.task === " ") {
      open++;
    } else if (item.task === "x" || item.task === "X") {
      done++;
    }
  }
  return { done, open };
}

export interface IDayStats {
  date: string;
  hasNote: boolean;
  words: number;
  tasksDone: number;
  tasksOpen: number;
}

export interface IMonthSummary {
  totalWords: number;
  /** Average words per day over all days of the month. */
  avgWordsPerDay: number;
  /** Average words per day over days that have a note. */
  avgWordsPerNote: number;
  daysWithNotes: number;
  daysInMonth: number;
  tasksDone: number;
  tasksTotal: number;
  /** Days whose note has at least one task and no open ones (✓ days). */
  allDoneDays: number;
}

/** ✓ rule: at least one task and every task done. */
export function isAllTasksDone(day: { tasksDone: number; tasksOpen: number }): boolean {
  return day.tasksDone > 0 && day.tasksOpen === 0;
}

/**
 * Number of consecutive ✓ days ending at the anchor day (daysAgo = 0) and
 * going back in time. With `pendingAnchor` (anchor = today) an unfinished
 * anchor day does not break the streak: counting starts from the day before.
 */
export function currentStreak(
  isDone: (daysAgo: number) => boolean,
  options: { pendingAnchor?: boolean; limit?: number } = {},
): number {
  const limit = options.limit ?? 366;
  let start = 0;
  if (!isDone(0)) {
    if (!options.pendingAnchor) {
      return 0;
    }
    start = 1;
  }
  let streak = 0;
  for (let i = start; i < limit && isDone(i); i++) {
    streak++;
  }
  return streak;
}

export function summarizeMonth(days: IDayStats[]): IMonthSummary {
  const withNotes = days.filter((d) => d.hasNote);
  const totalWords = withNotes.reduce((s, d) => s + d.words, 0);
  const tasksDone = withNotes.reduce((s, d) => s + d.tasksDone, 0);
  const tasksOpen = withNotes.reduce((s, d) => s + d.tasksOpen, 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    totalWords,
    avgWordsPerDay: days.length ? round1(totalWords / days.length) : 0,
    avgWordsPerNote: withNotes.length ? round1(totalWords / withNotes.length) : 0,
    daysWithNotes: withNotes.length,
    daysInMonth: days.length,
    tasksDone,
    tasksTotal: tasksDone + tasksOpen,
    allDoneDays: withNotes.filter(isAllTasksDone).length,
  };
}

/** Max number of tasks carried over into a new note. */
export const MAX_CARRYOVER_TASKS = 200;

/**
 * Open tasks (`- [ ] ...`) of a note, as markdown lines ready for
 * {{carryover}}. Indentation is kept, fenced code is skipped, and "<%" is
 * escaped so plugins such as Templater never execute carried-over text.
 */
export function extractOpenTasks(text: string, max = MAX_CARRYOVER_TASKS): string[] {
  const result: string[] = [];
  let inFence = false;
  for (const line of (text || "").split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !/^\s*(?:[-*+]|\d+[.)])\s+\[ \]\s*\S/.test(line)) {
      continue;
    }
    result.push(line.trimEnd().replace(/<%/g, "<\\%"));
    if (result.length >= max) {
      break;
    }
  }
  return result;
}
