/**
 * "Open a random daily note": pure selection over existing days.
 * Days are "YYYY-MM-DD" keys, one per day (duplicates already merged by
 * the note index). `random` is injectable for tests.
 */

export type RandomScope =
  | { kind: "all" }
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number } // month 1..12
  | { kind: "lastDays"; days: number; today: string };

export interface IRandomOptions {
  /** Day to avoid (the note opened last), unless it is the only candidate. */
  exclude?: string | null;
  random?: () => number;
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Shifts a YYYY-MM-DD key by n days (UTC arithmetic, no time zones). */
export function shiftDay(day: string, n: number): string {
  const m = DAY_RE.exec(day);
  if (!m) return day;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

export function inScope(day: string, scope: RandomScope): boolean {
  const m = DAY_RE.exec(day);
  if (!m) return false;
  switch (scope.kind) {
    case "all":
      return true;
    case "year":
      return +m[1] === scope.year;
    case "month":
      return +m[1] === scope.year && +m[2] === scope.month;
    case "lastDays": {
      const n = Math.max(1, Math.floor(scope.days));
      return day <= scope.today && day > shiftDay(scope.today, -n);
    }
  }
}

/** Unique, valid days within the scope (sorted). */
export function randomCandidates(days: Iterable<string>, scope: RandomScope): string[] {
  return Array.from(new Set(days))
    .filter((d) => inScope(d, scope))
    .sort();
}

const pickIndex = (n: number, random: () => number) =>
  Math.min(n - 1, Math.max(0, Math.floor(random() * n)));

/** Random day in the scope, or null when there is none. */
export function pickRandomDay(
  days: Iterable<string>,
  scope: RandomScope,
  opts: IRandomOptions = {},
): string | null {
  const random = opts.random || Math.random;
  let c = randomCandidates(days, scope);
  if (c.length > 1 && opts.exclude) c = c.filter((d) => d !== opts.exclude);
  return c.length ? c[pickIndex(c.length, random)] : null;
}

/**
 * Like pickRandomDay, but skips days for which `isEmpty` says true. Candidates
 * are drawn lazily in random order (partial Fisher-Yates), so only the drawn
 * notes are read. Returns null when every candidate is empty.
 */
export async function pickRandomNonEmptyDay(
  days: Iterable<string>,
  scope: RandomScope,
  isEmpty: (day: string) => Promise<boolean>,
  opts: IRandomOptions = {},
): Promise<string | null> {
  const random = opts.random || Math.random;
  const c = randomCandidates(days, scope);
  let excluded: string | null = null;
  if (c.length > 1 && opts.exclude && c.includes(opts.exclude)) {
    excluded = opts.exclude;
    c.splice(c.indexOf(opts.exclude), 1);
  }
  for (let n = c.length; n > 0; n--) {
    const i = pickIndex(n, random);
    const day = c[i];
    c[i] = c[n - 1];
    if (!(await isEmpty(day))) return day;
  }
  // The excluded one is still better than nothing.
  if (excluded && !(await isEmpty(excluded))) return excluded;
  return null;
}

/**
 * A note counts as empty when, after front matter, it has nothing but
 * headings, blank lines, horizontal rules and empty list/task markers
 * (what a typical daily template leaves behind).
 */
export function isBlankDailyNote(text: string): boolean {
  let body = text.replace(/^\uFEFF/, "");
  const fm = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/.exec(body);
  if (fm) body = body.slice(fm[0].length);
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .every(
      (l) =>
        l === "" ||
        /^#{1,6}(\s.*)?$/.test(l) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(l) ||
        /^([-*+]|\d+[.)])(\s+\[[ ]?\])?$/.test(l),
    );
}
