/**
 * Settings shape, defaults and migration (pure, no Obsidian API).
 */
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { CHART_KINDS, CHART_METRICS } from "./charts";
import type { ChartKind, ChartMetric } from "./charts";
import { DEFAULT_FORMATS } from "./dates";
import type { Granularity } from "./dates";
import { isValidHolidayPattern } from "./holidays";
import type { HolidayDateOrder } from "./holidays";
import type { IMove } from "./organize";
import { sanitizeVaultPath } from "./paths";
import { DEFAULT_DOTS_MODE, sanitizeDotsMode } from "./dots";
import type { DotsMode } from "./dots";
import { clampPrepDays, sanitizeImportantColor } from "./important";
import type { ImportantDays } from "./important";
import { EMPTY_WEEKDAY_TEMPLATES, WEEKDAY_KEYS, newRuleId, sanitizeCondition } from "./rules";
import type { ITemplateRule, IWeekdayTemplates } from "./rules";

export const SETTINGS_VERSION = 6;

/**
 * Open today's note on startup only when the plugin was loaded as part of
 * the app start (layout not ready yet at onload). Enabling the plugin or
 * reloading it in a running session must not open anything.
 */
export function shouldOpenOnStartup(
  enabled: boolean,
  layoutReadyAtLoad: boolean,
  dailyEnabled: boolean,
): boolean {
  return enabled && dailyEnabled && !layoutReadyAtLoad;
}

/** Where the ⋯ menu button sits. */
export type MenuPosition = "navLeft" | "navRight" | "titleLeft" | "toolbar";
export const MENU_POSITIONS: MenuPosition[] = ["navRight", "navLeft", "titleLeft", "toolbar"];

export interface IStatsView {
  mode: "table" | "charts";
  metric: ChartMetric;
  kind: ChartKind;
}

const GRANULARITY_LIST: Granularity[] = ["day", "week", "month"];

export type Language = "auto" | "en" | "ru";

export interface IPeriodicConfig {
  enabled: boolean;
  folder: string;
  format: string;
  template: string;
  /** v5 (2.4.0): new notes go to `folder/<YYYY>/`; lookup works for both layouts. */
  yearFolders?: boolean;
}

/** Journal of the last "organize by year" run (for undo). */
export interface IOrganizeJournal {
  at: string;
  moves: IMove[];
}

export interface ISettings {
  settingsVersion: number;
  language: Language;

  /** What the dots under days mean (v4). */
  dotsMode: DotsMode;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;
  /** 2.5.0: open (or create) today's daily note when Obsidian starts. */
  openDailyOnStartup: boolean;
  localeOverride: ILocaleOverride;

  daily: IPeriodicConfig;
  weekly: IPeriodicConfig;
  monthly: IPeriodicConfig;

  useWeekdayTemplates: boolean;
  weekdayTemplates: IWeekdayTemplates;
  templateRules: ITemplateRule[];

  importantDays: ImportantDays;
  lastOrganize: IOrganizeJournal | null;
  showUpcoming: boolean;
  /** 2.5.1: draw holiday marks (🎉) in the grid. Display only. */
  showHolidayMarks: boolean;
  /** 2.5.1: draw important-day rings and "get ready" highlight in the grid. Display only. */
  showImportantMarks: boolean;
  upcomingCollapsed: boolean;
  upcomingHorizonDays: number;

  showTemplatePreview: boolean;

  /** Folder with holiday notes ("" = off). */
  holidaysFolder: string;
  holidayDateOrder: HolidayDateOrder;
  /** Optional custom date format at the start of holiday file names. */
  holidayPattern: string;

  menuPosition: MenuPosition;
  statsView: IStatsView;
}

export function defaultPeriodic(g: Granularity, enabled: boolean): IPeriodicConfig {
  return { enabled, folder: "", format: DEFAULT_FORMATS[g], template: "" };
}

export function makeDefaultSettings(): ISettings {
  return {
    settingsVersion: SETTINGS_VERSION,
    language: "auto",
    dotsMode: DEFAULT_DOTS_MODE,
    weekStart: "locale" as IWeekStartOption,
    shouldConfirmBeforeCreate: true,
    openDailyOnStartup: false,
    localeOverride: "system-default",
    daily: defaultPeriodic("day", true),
    weekly: defaultPeriodic("week", false),
    monthly: defaultPeriodic("month", false),
    useWeekdayTemplates: false,
    weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES },
    templateRules: [],
    importantDays: {},
    lastOrganize: null,
    showUpcoming: true,
    showHolidayMarks: true,
    showImportantMarks: true,
    upcomingCollapsed: false,
    upcomingHorizonDays: 60,
    showTemplatePreview: true,
    holidaysFolder: "",
    holidayDateOrder: "dayFirst",
    holidayPattern: "",
    menuPosition: "navRight",
    statsView: { mode: "table", metric: "words", kind: "bar" },
  };
}

export const defaultSettings: ISettings = Object.freeze(makeDefaultSettings()) as ISettings;

/** Settings of other plugins, read only on explicit import (or v1 migration). */
export interface IExternalPeriodicSettings {
  daily?: Partial<IPeriodicConfig> | null;
  weekly?: Partial<IPeriodicConfig> | null;
  monthly?: Partial<IPeriodicConfig> | null;
}

/**
 * Limits for values read from data.json. Far above real use; they only stop
 * a corrupted or hostile file from making the plugin slow or huge.
 */
export const LIMITS = {
  path: 512,
  format: 128,
  text: 200,
  rules: 200,
  importantDays: 5000,
} as const;

const WEEK_START_OPTIONS = ["locale", ...WEEKDAY_KEYS] as const;
// moment locale ids look like "en", "en-gb", "zh-cn", "tzm-latn".
const LOCALE_ID = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/;

/** String or fallback; control characters removed and length capped. */
function str(v: unknown, fallback = "", max: number = LIMITS.path): string {
  if (typeof v !== "string") {
    return fallback;
  }
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

export function sanitizeWeekStart(v: unknown): IWeekStartOption {
  return (WEEK_START_OPTIONS as readonly unknown[]).includes(v)
    ? (v as IWeekStartOption)
    : ("locale" as IWeekStartOption);
}

/** Only well-formed moment locale ids reach `moment.locale()`. */
export function sanitizeLocale(v: unknown): ILocaleOverride {
  return typeof v === "string" && LOCALE_ID.test(v) ? (v as ILocaleOverride) : "system-default";
}

function sanitizeWeekdayTemplates(raw: unknown): IWeekdayTemplates {
  const out: IWeekdayTemplates = { ...EMPTY_WEEKDAY_TEMPLATES };
  if (raw && typeof raw === "object") {
    for (const key of WEEKDAY_KEYS) {
      out[key] = str((raw as Record<string, unknown>)[key]).trim();
    }
  }
  return out;
}

function sanitizePeriodic(raw: unknown, g: Granularity, defaultEnabled: boolean): IPeriodicConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (raw || {}) as any;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaultEnabled,
    folder: str(r.folder).trim(),
    format: str(r.format, "", LIMITS.format).trim() || DEFAULT_FORMATS[g],
    template: str(r.template).trim(),
    ...(r.yearFolders === true ? { yearFolders: true } : {}),
  };
}

/** Merge external settings into a config, keeping `enabled` as is. */
export function mergeExternal(
  base: IPeriodicConfig,
  ext: Partial<IPeriodicConfig> | null | undefined,
  g: Granularity,
): IPeriodicConfig {
  if (!ext) {
    return base;
  }
  return {
    ...base,
    enabled: base.enabled,
    folder: str(ext.folder, base.folder).trim(),
    format: str(ext.format, "", LIMITS.format).trim() || base.format || DEFAULT_FORMATS[g],
    template: str(ext.template, base.template).trim(),
  };
}

export function sanitizeRules(raw: unknown): ITemplateRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rules: ITemplateRule[] = [];
  for (const r of raw.slice(0, LIMITS.rules)) {
    const condition = r && typeof r === "object" ? sanitizeCondition(r.condition) : null;
    if (!condition) {
      continue;
    }
    const appliesTo = Array.isArray(r.appliesTo)
      ? GRANULARITY_LIST.filter((g) => r.appliesTo.includes(g))
      : [];
    rules.push({
      id: str(r.id, "", 64) || newRuleId(),
      name: str(r.name, "", LIMITS.text),
      enabled: r.enabled !== false,
      condition,
      template: str(r.template).trim(),
      appliesTo: appliesTo.length ? appliesTo : ["day"],
    });
  }
  return rules;
}

export function sanitizeImportant(raw: unknown): ImportantDays {
  const out: ImportantDays = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return out;
  }
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") {
      continue;
    }
    if (++count > LIMITS.importantDays) {
      break;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = v as any;
    out[k] = {
      title: str(d.title, "", LIMITS.text),
      color: sanitizeImportantColor(d.color),
      prepDays: clampPrepDays(Number(d.prepDays ?? 0)),
    };
  }
  return out;
}

function sanitizeStatsView(raw: unknown): IStatsView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (raw && typeof raw === "object" ? raw : {}) as any;
  return {
    mode: r.mode === "charts" ? "charts" : "table",
    metric: CHART_METRICS.includes(r.metric) ? r.metric : "words",
    kind: CHART_KINDS.includes(r.kind) ? r.kind : "bar",
  };
}

/**
 * Bring saved data (any version) to the current shape.
 *
 * v1 (1.0.0, no `settingsVersion`): daily note folder/format/template came
 * from the core Daily Notes / Periodic Notes plugin, weekly from
 * `weeklyNote*` fields or Periodic Notes. To keep the behaviour after the
 * upgrade, `externalForV1` (read once by the caller) is copied in.
 *
 * Fresh install (`raw` empty): defaults, nothing is imported.
 */
export function migrateSettings(
  raw: unknown,
  externalForV1: IExternalPeriodicSettings = {},
): { settings: ISettings; migratedFrom: number | null } {
  const defaults = makeDefaultSettings();
  if (!raw || typeof raw !== "object") {
    return { settings: defaults, migratedFrom: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;
  const version = typeof r.settingsVersion === "number" ? r.settingsVersion : 1;

  let daily: IPeriodicConfig;
  let weekly: IPeriodicConfig;
  let monthly: IPeriodicConfig;

  if (version < 2) {
    daily = mergeExternal(defaultPeriodic("day", true), externalForV1.daily, "day");
    weekly = {
      enabled: !!r.showWeeklyNote,
      folder: str(r.weeklyNoteFolder).trim(),
      format: str(r.weeklyNoteFormat, "", LIMITS.format).trim() || DEFAULT_FORMATS.week,
      template: str(r.weeklyNoteTemplate).trim(),
    };
    if (externalForV1.weekly) {
      weekly = mergeExternal(weekly, externalForV1.weekly, "week");
    }
    monthly = mergeExternal(defaultPeriodic("month", false), externalForV1.monthly, "month");
  } else {
    daily = sanitizePeriodic(r.daily, "day", true);
    weekly = sanitizePeriodic(r.weekly, "week", false);
    monthly = sanitizePeriodic(r.monthly, "month", false);
  }

  const settings: ISettings = {
    settingsVersion: SETTINGS_VERSION,
    language: ["auto", "en", "ru"].includes(r.language) ? r.language : defaults.language,
    // v4 (2.3.0): `wordsPerDot` is dropped; dots meaning is a mode.
    // v5 (2.4.0): default is "exists"; v4 stored the old default "tasks"
    // explicitly, so it is switched once (a choice made in v5+ is kept).
    dotsMode: version < 5 && r.dotsMode === "tasks" ? "exists" : sanitizeDotsMode(r.dotsMode),
    weekStart: sanitizeWeekStart(r.weekStart),
    openDailyOnStartup: r.openDailyOnStartup === true,
    shouldConfirmBeforeCreate:
      typeof r.shouldConfirmBeforeCreate === "boolean"
        ? r.shouldConfirmBeforeCreate
        : defaults.shouldConfirmBeforeCreate,
    localeOverride: sanitizeLocale(r.localeOverride),
    daily,
    weekly,
    monthly,
    useWeekdayTemplates: !!r.useWeekdayTemplates,
    weekdayTemplates: sanitizeWeekdayTemplates(r.weekdayTemplates),
    templateRules: sanitizeRules(r.templateRules),
    importantDays: sanitizeImportant(r.importantDays),
    showUpcoming: typeof r.showUpcoming === "boolean" ? r.showUpcoming : defaults.showUpcoming,
    showHolidayMarks: r.showHolidayMarks !== false,
    showImportantMarks: r.showImportantMarks !== false,
    upcomingCollapsed: !!r.upcomingCollapsed,
    upcomingHorizonDays:
      typeof r.upcomingHorizonDays === "number" && r.upcomingHorizonDays > 0
        ? clampHorizon(r.upcomingHorizonDays)
        : defaults.upcomingHorizonDays,
    showTemplatePreview:
      typeof r.showTemplatePreview === "boolean"
        ? r.showTemplatePreview
        : defaults.showTemplatePreview,
    // v3 (2.2.0): new fields only, existing rules keep their meaning.
    holidaysFolder: str(r.holidaysFolder).trim(),
    holidayDateOrder: r.holidayDateOrder === "monthFirst" ? "monthFirst" : "dayFirst",
    holidayPattern: (() => {
      const p = str(r.holidayPattern, "", 24).trim();
      return isValidHolidayPattern(p) ? p : "";
    })(),
    menuPosition: MENU_POSITIONS.includes(r.menuPosition) ? r.menuPosition : defaults.menuPosition,
    statsView: sanitizeStatsView(r.statsView),
    lastOrganize: sanitizeJournal(r.lastOrganize),
  };
  return { settings, migratedFrom: version < SETTINGS_VERSION ? version : null };
}

export const HORIZON_MIN = 7;
export const HORIZON_MAX = 365;
export const MAX_JOURNAL_MOVES = 50000;

export function clampHorizon(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    return 60;
  }
  return Math.min(HORIZON_MAX, Math.max(HORIZON_MIN, Math.round(n)));
}

function sanitizeJournal(raw: unknown): IOrganizeJournal | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = raw as any;
  if (!r || typeof r !== "object" || !Array.isArray(r.moves)) {
    return null;
  }
  const moves: IMove[] = [];
  for (const m of r.moves.slice(0, MAX_JOURNAL_MOVES)) {
    if (!m || typeof m.from !== "string" || typeof m.to !== "string") {
      continue;
    }
    const from = sanitizeVaultPath(m.from);
    const to = sanitizeVaultPath(m.to);
    if (from && to && from.endsWith(".md") && to.endsWith(".md")) {
      moves.push({ from, to, year: str(m.year, "", 4) });
    }
  }
  return moves.length ? { at: str(r.at, "", 40), moves } : null;
}

/** Pick the config of a note type. */
export function periodicConfig(settings: ISettings, g: Granularity): IPeriodicConfig {
  const cfg = g === "day" ? settings.daily : g === "week" ? settings.weekly : settings.monthly;
  return cfg || defaultPeriodic(g, g === "day");
}
