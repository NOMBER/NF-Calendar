/** What the dots under calendar days mean (pure helpers). */

export const DOTS_MODES = ["tasks", "words", "exists", "none"] as const;
export type DotsMode = (typeof DOTS_MODES)[number];
export const DEFAULT_DOTS_MODE: DotsMode = "tasks";

/** Fixed word-count thresholds: one dot per threshold reached (1..5). */
export const WORD_DOT_THRESHOLDS = [1, 250, 500, 1000, 2000] as const;
export const MAX_DOTS = 5;

export interface IDotSpec {
  isFilled: boolean;
  className?: string;
}

export interface INoteFacts {
  exists: boolean;
  words: number;
  tasksDone: number;
  tasksOpen: number;
}

export function sanitizeDotsMode(v: unknown): DotsMode {
  return (DOTS_MODES as readonly unknown[]).includes(v) ? (v as DotsMode) : DEFAULT_DOTS_MODE;
}

export function wordDots(words: number): number {
  if (!Number.isFinite(words) || words <= 0) {
    return 0;
  }
  return WORD_DOT_THRESHOLDS.filter((th) => words >= th).length;
}

/**
 * Tasks mode: one dot per task (max 5, scaled); filled dots show the done share.
 * A note without tasks gets no dots.
 */
export function taskDots(done: number, open: number): IDotSpec[] {
  const d = Math.max(0, Math.floor(done) || 0);
  const o = Math.max(0, Math.floor(open) || 0);
  const total = d + o;
  if (total === 0) {
    return [];
  }
  const count = Math.min(total, MAX_DOTS);
  const filled = d === total ? count : Math.min(count - 1, Math.round((d / total) * count));
  const out: IDotSpec[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i < filled ? { isFilled: true } : { isFilled: false, className: "task" });
  }
  return out;
}

export function dotsFor(mode: DotsMode, facts: INoteFacts): IDotSpec[] {
  if (!facts.exists || mode === "none") {
    return [];
  }
  switch (mode) {
    case "tasks":
      return taskDots(facts.tasksDone, facts.tasksOpen);
    case "words":
      return Array.from({ length: wordDots(facts.words) }, () => ({ isFilled: true }));
    case "exists":
      return [{ isFilled: true }];
    default:
      return [];
  }
}

/** Does this mode need the note text? */
export function modeNeedsContent(mode: DotsMode): boolean {
  return mode === "tasks" || mode === "words";
}
