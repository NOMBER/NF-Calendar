/**
 * Special template rules and the template priority chain (pure, no Obsidian API).
 *
 * Priority for a DAILY note:
 *   1. matching enabled special rules, in list order
 *   2. weekday template (if enabled and set)
 *   3. default daily template
 * Weekly / monthly notes: rules that apply to that note type (evaluated on
 * the FIRST day of the period), then the default template of that type.
 *
 * If a template file does not exist, the next candidate is used.
 */
import type { Moment } from "moment";

import type { Granularity } from "./dates";
import { isRecord } from "./unknown";

/** Index matches moment's `date.day()` (0 = Sunday ... 6 = Saturday). */
export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
export type IWeekdayTemplates = Record<WeekdayKey, string>;

export const EMPTY_WEEKDAY_TEMPLATES: IWeekdayTemplates = {
  sunday: "",
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
};

export type RuleCondition =
  | { type: "annual"; monthDay: string } // MM-DD, every year
  | { type: "monthDays"; from: number; to: number } // days of month, inclusive (wraps if from > to)
  | { type: "lastDays"; count: number } // last N days of the month
  | { type: "monthEdge"; edge: "first" | "last" } // first / last day of the month
  | { type: "quarterEdge"; edge: "start" | "end" } // first / last day of the quarter
  | { type: "weekdays"; days: number[] } // any of these weekdays (0 = Sunday)
  | { type: "nthWeekday"; nth: number; weekday: number } // nth 1..5 or -1 = last
  | { type: "weekOfMonth"; week: number } // 1..6 or -1 = last week (locale weeks)
  | { type: "weekParity"; parity: "even" | "odd" } // ISO week number
  | { type: "everyNDays"; start: string; every: number } // YYYY-MM-DD, every >= 1
  | { type: "holiday" } // a holiday from the holidays folder falls on the day
  | { type: "important" } // the day is marked as important
  | { type: "range"; from: string; to: string } // YYYY-MM-DD, inclusive
  | { type: "date"; date: string }; // YYYY-MM-DD, one-off

export type RuleConditionType = RuleCondition["type"];

/** Order shown in the settings picker (yearly date first, one-off date last). */
export const RULE_CONDITION_TYPES: RuleConditionType[] = [
  "annual",
  "monthDays",
  "lastDays",
  "monthEdge",
  "quarterEdge",
  "weekdays",
  "nthWeekday",
  "weekOfMonth",
  "weekParity",
  "everyNDays",
  "holiday",
  "important",
  "range",
  "date",
];

/** Groups for the compact type picker in settings. */
export const RULE_CONDITION_GROUPS: Array<{ group: string; types: RuleConditionType[] }> = [
  { group: "dates", types: ["annual", "range", "date"] },
  { group: "month", types: ["monthDays", "lastDays", "monthEdge", "quarterEdge"] },
  { group: "week", types: ["weekdays", "nthWeekday", "weekOfMonth", "weekParity", "everyNDays"] },
  { group: "marks", types: ["holiday", "important"] },
];

export interface ITemplateRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  template: string;
  /** Note types the rule applies to. Missing/empty = daily only. */
  appliesTo?: Granularity[];
}

/** Information about a day that lives outside the rule itself. */
export interface IRuleContext {
  isHoliday?: (date: Moment) => boolean;
  isImportant?: (date: Moment) => boolean;
}

export function defaultCondition(type: RuleConditionType): RuleCondition {
  switch (type) {
    case "date":
      return { type, date: "" };
    case "annual":
      return { type, monthDay: "" };
    case "range":
      return { type, from: "", to: "" };
    case "monthDays":
      return { type, from: 1, to: 7 };
    case "lastDays":
      return { type, count: 3 };
    case "monthEdge":
      return { type, edge: "first" };
    case "quarterEdge":
      return { type, edge: "start" };
    case "weekdays":
      return { type, days: [1, 2, 3, 4, 5] };
    case "nthWeekday":
      return { type, nth: 1, weekday: 1 };
    case "weekOfMonth":
      return { type, week: 1 };
    case "weekParity":
      return { type, parity: "even" };
    case "everyNDays":
      return { type, start: "", every: 2 };
    case "holiday":
      return { type };
    case "important":
      return { type };
  }
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** Longest month per month number (Feb 29 allowed for yearly dates). */
const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isValidMonthDay(monthDay: string): boolean {
  if (!MONTH_DAY.test(monthDay || "")) {
    return false;
  }
  const [m, d] = monthDay.split("-").map(Number);
  return d <= MAX_DAYS[m - 1];
}

const inRange = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/**
 * Rebuild a condition from untrusted data (data.json): only known types and
 * fields of the right primitive type survive. Returns null for garbage.
 * Half filled-in values are kept so the user can finish editing them.
 */
export function sanitizeCondition(raw: unknown): RuleCondition | null {
  if (!isRecord(raw)) {
    return null;
  }
  const r = raw;
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : "");
  const int = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isInteger(v) ? v : fallback;
  switch (r.type) {
    case "date":
      return { type: "date", date: text(r.date) };
    case "annual":
      return { type: "annual", monthDay: text(r.monthDay) };
    case "range":
      return { type: "range", from: text(r.from), to: text(r.to) };
    case "monthDays":
      return { type: "monthDays", from: int(r.from, 1), to: int(r.to, 1) };
    case "lastDays":
      return { type: "lastDays", count: int(r.count, 1) };
    case "monthEdge":
      return { type: "monthEdge", edge: r.edge === "last" ? "last" : "first" };
    case "quarterEdge":
      return { type: "quarterEdge", edge: r.edge === "end" ? "end" : "start" };
    case "weekdays": {
      const days: unknown[] = Array.isArray(r.days) ? r.days.slice(0, 7) : [];
      const valid = days.filter((d): d is number => typeof d === "number" && inRange(d, 0, 6));
      return { type: "weekdays", days: Array.from(new Set(valid)).sort() };
    }
    case "nthWeekday":
      return { type: "nthWeekday", nth: int(r.nth, 1), weekday: int(r.weekday, 1) };
    case "weekOfMonth":
      return { type: "weekOfMonth", week: int(r.week, 1) };
    case "weekParity":
      return { type: "weekParity", parity: r.parity === "odd" ? "odd" : "even" };
    case "everyNDays":
      return { type: "everyNDays", start: text(r.start), every: int(r.every, 2) };
    case "holiday":
      return { type: "holiday" };
    case "important":
      return { type: "important" };
    default:
      return null;
  }
}

/** Is the condition fully filled in? (Invalid conditions never match.) */
export function isConditionValid(cond: RuleCondition): boolean {
  if (!cond) {
    return false;
  }
  switch (cond.type) {
    case "date":
      return ISO_DATE.test(cond.date || "");
    case "annual":
      return isValidMonthDay(cond.monthDay);
    case "range":
      return ISO_DATE.test(cond.from || "") && ISO_DATE.test(cond.to || "");
    case "monthDays":
      return inRange(cond.from, 1, 31) && inRange(cond.to, 1, 31);
    case "lastDays":
      return inRange(cond.count, 1, 31);
    case "monthEdge":
      return cond.edge === "first" || cond.edge === "last";
    case "quarterEdge":
      return cond.edge === "start" || cond.edge === "end";
    case "weekdays":
      return (
        Array.isArray(cond.days) && cond.days.length > 0 && cond.days.every((d) => inRange(d, 0, 6))
      );
    case "nthWeekday":
      return (inRange(cond.nth, 1, 5) || cond.nth === -1) && inRange(cond.weekday, 0, 6);
    case "weekOfMonth":
      return inRange(cond.week, 1, 6) || cond.week === -1;
    case "weekParity":
      return cond.parity === "even" || cond.parity === "odd";
    case "everyNDays":
      return ISO_DATE.test(cond.start || "") && inRange(cond.every, 1, 3660);
    case "holiday":
    case "important":
      return true;
    default:
      return false;
  }
}

/** 1-based week of the month, weeks start on the locale's first weekday. */
export function weekOfMonth(date: Moment): number {
  const first = date.clone().startOf("month").startOf("week");
  const days = date.clone().startOf("day").diff(first.clone().startOf("day"), "days");
  return Math.floor(days / 7) + 1;
}

export function matchesCondition(
  date: Moment,
  cond: RuleCondition,
  ctx: IRuleContext = {},
): boolean {
  if (!isConditionValid(cond)) {
    return false;
  }
  switch (cond.type) {
    case "date":
      return date.format("YYYY-MM-DD") === cond.date;
    case "annual":
      return date.format("MM-DD") === cond.monthDay;
    case "range": {
      const d = date.format("YYYY-MM-DD");
      const [from, to] = cond.from <= cond.to ? [cond.from, cond.to] : [cond.to, cond.from];
      return d >= from && d <= to;
    }
    case "monthDays": {
      const day = date.date();
      return cond.from <= cond.to
        ? day >= cond.from && day <= cond.to
        : day >= cond.from || day <= cond.to; // e.g. 25..5 wraps over the month end
    }
    case "lastDays":
      return date.daysInMonth() - date.date() < cond.count;
    case "monthEdge":
      return cond.edge === "first" ? date.date() === 1 : date.date() === date.daysInMonth();
    case "quarterEdge": {
      const edge =
        cond.edge === "start" ? date.clone().startOf("quarter") : date.clone().endOf("quarter");
      return date.isSame(edge, "day");
    }
    case "weekdays":
      return cond.days.includes(date.day());
    case "nthWeekday": {
      if (date.day() !== cond.weekday) {
        return false;
      }
      if (cond.nth === -1) {
        return date.date() + 7 > date.daysInMonth();
      }
      return Math.ceil(date.date() / 7) === cond.nth;
    }
    case "weekOfMonth": {
      if (cond.week === -1) {
        return weekOfMonth(date) === weekOfMonth(date.clone().endOf("month"));
      }
      return weekOfMonth(date) === cond.week;
    }
    case "weekParity": {
      const even = date.isoWeek() % 2 === 0;
      return cond.parity === "even" ? even : !even;
    }
    case "everyNDays": {
      const start = date.clone().startOf("day");
      start.set({
        year: Number(cond.start.slice(0, 4)),
        month: Number(cond.start.slice(5, 7)) - 1,
        date: Number(cond.start.slice(8, 10)),
      });
      const diff = Math.round(date.clone().startOf("day").diff(start, "days", true));
      return diff >= 0 && diff % cond.every === 0;
    }
    case "holiday":
      return !!ctx.isHoliday?.(date);
    case "important":
      return !!ctx.isImportant?.(date);
  }
}

export function ruleAppliesTo(rule: ITemplateRule, granularity: Granularity): boolean {
  const scope = rule.appliesTo && rule.appliesTo.length ? rule.appliesTo : ["day"];
  return scope.includes(granularity);
}

export type TemplateSource = "rule" | "weekday" | "default";

export interface ITemplateCandidate {
  path: string;
  source: TemplateSource;
  ruleId?: string;
  ruleName?: string;
  weekday?: WeekdayKey;
}

export interface ITemplateChoiceSettings {
  templateRules?: ITemplateRule[];
  useWeekdayTemplates?: boolean;
  weekdayTemplates?: Partial<IWeekdayTemplates>;
  /** Default template of the note type. */
  defaultTemplate?: string;
}

/**
 * Ordered list of templates that could be used for a note.
 * For week/month notes pass the first day of the period as `date`.
 */
export function getTemplateCandidates(
  date: Moment,
  settings: ITemplateChoiceSettings,
  granularity: Granularity = "day",
  ctx: IRuleContext = {},
): ITemplateCandidate[] {
  const result: ITemplateCandidate[] = [];
  for (const rule of settings.templateRules || []) {
    const path = (rule?.template || "").trim();
    if (
      rule &&
      rule.enabled &&
      path &&
      ruleAppliesTo(rule, granularity) &&
      matchesCondition(date, rule.condition, ctx)
    ) {
      result.push({ path, source: "rule", ruleId: rule.id, ruleName: rule.name });
    }
  }
  if (granularity === "day" && settings.useWeekdayTemplates) {
    const weekday = WEEKDAY_KEYS[date.day()];
    const path = (settings.weekdayTemplates?.[weekday] || "").trim();
    if (path) {
      result.push({ path, source: "weekday", weekday });
    }
  }
  const def = (settings.defaultTemplate || "").trim();
  if (def) {
    result.push({ path: def, source: "default" });
  }
  return result;
}

export interface ITemplateResolution {
  /** Chosen template, or null = create an empty note. */
  chosen: ITemplateCandidate | null;
  /** Candidates that were skipped because their file does not exist. */
  missing: ITemplateCandidate[];
}

/** Walk the candidates and pick the first one whose file exists. */
export function resolveTemplate(
  candidates: ITemplateCandidate[],
  exists: (path: string) => boolean,
): ITemplateResolution {
  const missing: ITemplateCandidate[] = [];
  for (const c of candidates) {
    if (exists(c.path)) {
      return { chosen: c, missing };
    }
    missing.push(c);
  }
  return { chosen: null, missing };
}

/** Convenience: candidates + resolution in one call. */
export function chooseTemplate(
  date: Moment,
  settings: ITemplateChoiceSettings,
  granularity: Granularity,
  exists: (path: string) => boolean,
  ctx: IRuleContext = {},
): ITemplateResolution {
  return resolveTemplate(getTemplateCandidates(date, settings, granularity, ctx), exists);
}

/** Order weekday keys starting with the given first day of week. */
export function orderedWeekdays(firstDayOfWeek: number): WeekdayKey[] {
  const start = ((firstDayOfWeek % 7) + 7) % 7;
  return WEEKDAY_KEYS.map((_, i) => WEEKDAY_KEYS[(start + i) % 7]);
}

let idCounter = 0;
export function newRuleId(): string {
  idCounter += 1;
  return `r${Date.now().toString(36)}${idCounter}`;
}
