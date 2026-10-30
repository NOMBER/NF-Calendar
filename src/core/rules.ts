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

export const EMPTY_WEEKDAY_TEMPLATES: IWeekdayTemplates = Object.freeze({
  sunday: "",
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
}) as IWeekdayTemplates;

export type RuleCondition =
  | { type: "date"; date: string } // YYYY-MM-DD
  | { type: "annual"; monthDay: string } // MM-DD
  | { type: "range"; from: string; to: string } // YYYY-MM-DD, inclusive
  | { type: "nthWeekday"; nth: number; weekday: number } // nth 1..5 or -1 = last
  | { type: "weekParity"; parity: "even" | "odd" }; // ISO week number

export type RuleConditionType = RuleCondition["type"];

export const RULE_CONDITION_TYPES: RuleConditionType[] = [
  "date",
  "annual",
  "range",
  "nthWeekday",
  "weekParity",
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

export function defaultCondition(type: RuleConditionType): RuleCondition {
  switch (type) {
    case "date":
      return { type, date: "" };
    case "annual":
      return { type, monthDay: "" };
    case "range":
      return { type, from: "", to: "" };
    case "nthWeekday":
      return { type, nth: 1, weekday: 1 };
    case "weekParity":
      return { type, parity: "even" };
  }
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Rebuild a condition from untrusted data (data.json): only known types and
 * fields of the right primitive type survive. Returns null for garbage.
 * Half filled-in values are kept so the user can finish editing them.
 */
export function sanitizeCondition(raw: unknown): RuleCondition | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;
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
    case "nthWeekday":
      return { type: "nthWeekday", nth: int(r.nth, 1), weekday: int(r.weekday, 1) };
    case "weekParity":
      return { type: "weekParity", parity: r.parity === "odd" ? "odd" : "even" };
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
      return MONTH_DAY.test(cond.monthDay || "");
    case "range":
      return ISO_DATE.test(cond.from || "") && ISO_DATE.test(cond.to || "");
    case "nthWeekday":
      return (
        ((cond.nth >= 1 && cond.nth <= 5) || cond.nth === -1) &&
        cond.weekday >= 0 &&
        cond.weekday <= 6
      );
    case "weekParity":
      return cond.parity === "even" || cond.parity === "odd";
    default:
      return false;
  }
}

export function matchesCondition(date: Moment, cond: RuleCondition): boolean {
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
    case "nthWeekday": {
      if (date.day() !== cond.weekday) {
        return false;
      }
      if (cond.nth === -1) {
        return date.date() + 7 > date.daysInMonth();
      }
      return Math.ceil(date.date() / 7) === cond.nth;
    }
    case "weekParity": {
      const even = date.isoWeek() % 2 === 0;
      return cond.parity === "even" ? even : !even;
    }
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
): ITemplateCandidate[] {
  const result: ITemplateCandidate[] = [];
  for (const rule of settings.templateRules || []) {
    const path = (rule?.template || "").trim();
    if (
      rule &&
      rule.enabled &&
      path &&
      ruleAppliesTo(rule, granularity) &&
      matchesCondition(date, rule.condition)
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
): ITemplateResolution {
  return resolveTemplate(getTemplateCandidates(date, settings, granularity), exists);
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
