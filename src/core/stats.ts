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
  items: Array<{ task?: string }> | null | undefined
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
  };
}
