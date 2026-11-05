/**
 * "Open a random daily note": pure selection over existing days.
 * Days are "YYYY-MM-DD" keys. Prefs may hold several ranges; the pick draws
 * from their union (deduped). `random` is injectable for tests.
 */

export type RandomScope =
  | { kind: "all" }
  | { kind: "year"; year: number }
  | { kind: "month"; year: number; month: number } // month 1..12
  | { kind: "lastDays"; days: number; today: string }
  | { kind: "range"; from: string; to: string }; // inclusive, either order

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
    case "range": {
      const [a, b] = scope.from <= scope.to ? [scope.from, scope.to] : [scope.to, scope.from];
      return DAY_RE.test(a) && DAY_RE.test(b) && day >= a && day <= b;
    }
    case "lastDays": {
      const n = Math.max(1, Math.floor(scope.days));
      return day <= scope.today && day > shiftDay(scope.today, -n);
    }
  }
}

export function normalizeScopes(scope: RandomScope | RandomScope[]): RandomScope[] {
  return Array.isArray(scope) ? scope : [scope];
}

/** Unique, valid days within any of the scopes (sorted). */
export function randomCandidates(
  days: Iterable<string>,
  scope: RandomScope | RandomScope[],
): string[] {
  const scopes = normalizeScopes(scope);
  if (!scopes.length) return [];
  const set = new Set<string>();
  for (const d of days) {
    if (!DAY_RE.test(d)) continue;
    if (scopes.some((s) => inScope(d, s))) set.add(d);
  }
  return Array.from(set).sort();
}

const pickIndex = (n: number, random: () => number) =>
  Math.min(n - 1, Math.max(0, Math.floor(random() * n)));

/** Random day in the (union of) scope(s), or null when there is none. */
export function pickRandomDay(
  days: Iterable<string>,
  scope: RandomScope | RandomScope[],
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
  scope: RandomScope | RandomScope[],
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

/** Defaults for the random note (settings → "Random note"). */
export type RandomKind = RandomScope["kind"];
export const RANDOM_KINDS: RandomKind[] = ["all", "year", "month", "lastDays", "range"];

/** One period row in the multi-range random prefs. */
export interface IRandomRange {
  kind: RandomKind;
  days: number;
  from: string;
  to: string;
  /** Month 1..12 when kind is "month" (year comes from context unless year is set). */
  month: number;
  /** Optional year override for year/month kinds; 0 / omitted → use context year. */
  year: number;
}

export interface IRandomPrefs {
  ranges: IRandomRange[];
  skipEmpty: boolean;
}

export const MAX_RANDOM_DAYS = 36500;
export const MAX_RANDOM_RANGES = 12;

export function defaultRandomRange(): IRandomRange {
  return { kind: "all", days: 30, from: "", to: "", month: 1, year: 0 };
}

export function defaultRandomPrefs(): IRandomPrefs {
  return { ranges: [defaultRandomRange()], skipEmpty: false };
}

export function isDayKey(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === v;
}

function sanitizeRange(raw: unknown): IRandomRange {
  const d = defaultRandomRange();
  if (!raw || typeof raw !== "object") return d;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;
  const days = Math.floor(Number(r.days));
  const month = Math.floor(Number(r.month));
  const year = Math.floor(Number(r.year));
  return {
    kind: RANDOM_KINDS.includes(r.kind) ? r.kind : d.kind,
    days: days >= 1 && days <= MAX_RANDOM_DAYS ? days : d.days,
    from: isDayKey(r.from) ? r.from : "",
    to: isDayKey(r.to) ? r.to : "",
    month: month >= 1 && month <= 12 ? month : d.month,
    year: year >= 1000 && year <= 9999 ? year : 0,
  };
}

/**
 * Accepts v12 `{ ranges, skipEmpty }` and legacy single-range
 * `{ kind, days, from, to, skipEmpty }`.
 */
export function sanitizeRandomPrefs(raw: unknown): IRandomPrefs {
  const d = defaultRandomPrefs();
  if (!raw || typeof raw !== "object") return d;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;
  let ranges: IRandomRange[];
  if (Array.isArray(r.ranges) && r.ranges.length) {
    ranges = r.ranges.slice(0, MAX_RANDOM_RANGES).map(sanitizeRange);
  } else if (r.kind || r.from || r.to || r.days) {
    // v11 and earlier: one flat range object.
    ranges = [sanitizeRange(r)];
  } else {
    ranges = [defaultRandomRange()];
  }
  if (!ranges.length) ranges = [defaultRandomRange()];
  return { ranges, skipEmpty: r.skipEmpty === true };
}

/**
 * Scope for one range row. `ctxYear`/`ctxMonth` (1..12) are the navigator
 * (or today for the command) when the row has no year override.
 */
export function scopeFromRange(
  p: IRandomRange,
  today: string,
  ctxYear: number,
  ctxMonth: number,
): RandomScope {
  const year = p.year >= 1000 ? p.year : ctxYear;
  const month = p.month >= 1 && p.month <= 12 ? p.month : ctxMonth;
  switch (p.kind) {
    case "year":
      return { kind: "year", year };
    case "month":
      return { kind: "month", year, month };
    case "lastDays":
      return { kind: "lastDays", days: p.days, today };
    case "range":
      if (!p.from && !p.to) return { kind: "all" };
      return { kind: "range", from: p.from || "0000-01-01", to: p.to || "9999-12-31" };
    default:
      return { kind: "all" };
  }
}

/** All scopes for the current prefs (one per range row). */
export function scopesFromPrefs(
  p: IRandomPrefs,
  today: string,
  ctxYear: number,
  ctxMonth: number,
): RandomScope[] {
  const ranges = p.ranges?.length ? p.ranges : [defaultRandomRange()];
  return ranges.map((r) => scopeFromRange(r, today, ctxYear, ctxMonth));
}

/** @deprecated use scopesFromPrefs; kept for older call sites / tests. */
export function scopeFromPrefs(
  p: IRandomPrefs | (IRandomRange & { skipEmpty?: boolean }),
  today: string,
  year: number,
  month: number,
): RandomScope {
  if (p && typeof p === "object" && Array.isArray((p as IRandomPrefs).ranges)) {
    return scopesFromPrefs(p as IRandomPrefs, today, year, month)[0] ?? { kind: "all" };
  }
  return scopeFromRange(sanitizeRange(p), today, year, month);
}
