import { DEFAULT_DATE_FIELD_FORMAT, sanitizeDateFieldFormat } from "src/core/dateField";
import type { DateFieldFormat } from "src/core/dateField";
import type { StartupTabPosition } from "src/core/tabs";
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
import type { DailyFolderLayout, IMove } from "./organize";
import { sanitizeFolderLayout } from "./organize";
import { sanitizeVaultPath } from "./paths";
import { DEFAULT_DOTS_MODE, sanitizeDotsMode } from "./dots";
import type { DotsMode } from "./dots";
import { defaultMenuItems, sanitizeMenuItems } from "./menuItems";
import { defaultRandomPrefs, sanitizeRandomPrefs } from "./random";
import type { IRandomPrefs } from "./random";
import type { IMenuItemPref } from "./menuItems";
import {
  clampPrepDays,
  MAX_EVENTS_PER_DAY,
  sanitizeEventId,
  sanitizeImportantColor,
  sanitizeUpcomingFilter,
} from "./important";
import type { ImportantDays, IImportantEvent, UpcomingFilter } from "./important";
import { EMPTY_WEEKDAY_TEMPLATES, WEEKDAY_KEYS, newRuleId, sanitizeCondition } from "./rules";
import type { ITemplateRule, IWeekdayTemplates } from "./rules";
import { isOneOf, isRecord } from "./unknown";

export const SETTINGS_VERSION = 12;

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
export type MenuPosition = "navLeft" | "navRight" | "titleLeft" | "toolbar" | "hidden";
export const MENU_POSITIONS: MenuPosition[] = [
  "navRight",
  "navLeft",
  "titleLeft",
  "toolbar",
  "hidden",
];

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
  /**
   * Where new daily notes are stored (v11 / 2.10.0).
   * flat | year (`folder/2026/…`) | year-month (`folder/2026/11/…`).
   * Older data may still have a `yearFolders` flag; sanitizers read it from
   * raw unknown input and convert it to `folderLayout`.
   */
  folderLayout?: DailyFolderLayout;
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
  /** 2.8.0: new startup tab left (after pinned) or right. */
  startupTabPosition: StartupTabPosition;
  /** 2.8.0: order/separator of typed date fields. */
  dateFieldFormat: DateFieldFormat;
  /** 2.8.0: "create missing until end of week/month" from the open daily note. */
  missingFromOpenNote: boolean;
  localeOverride: ILocaleOverride;

  daily: IPeriodicConfig;
  weekly: IPeriodicConfig;
  monthly: IPeriodicConfig;

  useWeekdayTemplates: boolean;
  weekdayTemplates: IWeekdayTemplates;
  templateRules: ITemplateRule[];

  importantDays: ImportantDays;
  /** v10 (2.9.0): dismissed upcoming rows (`i:date:eventId` / `h:date:path`). */
  dismissedUpcoming: string[];
  /** v10 (2.9.0): filter for the upcoming list under the calendar. */
  upcomingFilter: UpcomingFilter;
  /** 2.9.1: hide the All/Holidays/Important filter control (list shows all). */
  hideUpcomingFilter: boolean;
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
  /** v7 (2.6.0): ⋯ menu items, order and visibility. */
  menuItems: IMenuItemPref[];
  /** v8 (2.7.0): random note defaults (command + navigator start values). */
  random: IRandomPrefs;
  statsView: IStatsView;
}

export function defaultPeriodic(g: Granularity, enabled: boolean): IPeriodicConfig {
  return { enabled, folder: "", format: DEFAULT_FORMATS[g], template: "", folderLayout: "flat" };
}

export function makeDefaultSettings(): ISettings {
  return {
    settingsVersion: SETTINGS_VERSION,
    language: "auto",
    dotsMode: DEFAULT_DOTS_MODE,
    weekStart: "locale",
    shouldConfirmBeforeCreate: true,
    openDailyOnStartup: false,
    startupTabPosition: "left",
    dateFieldFormat: DEFAULT_DATE_FIELD_FORMAT,
    missingFromOpenNote: true,
    localeOverride: "system-default",
    daily: defaultPeriodic("day", true),
    weekly: defaultPeriodic("week", false),
    monthly: defaultPeriodic("month", false),
    useWeekdayTemplates: false,
    weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES },
    templateRules: [],
    importantDays: {},
    dismissedUpcoming: [],
    upcomingFilter: "all",
    hideUpcomingFilter: false,
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
    menuItems: defaultMenuItems(),
    random: defaultRandomPrefs(),
    statsView: { mode: "table", metric: "words", kind: "bar" },
  };
}

export const defaultSettings: ISettings = makeDefaultSettings();

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
  importantEventsPerDay: MAX_EVENTS_PER_DAY,
  dismissedUpcoming: 2000,
  dismissedKey: 300,
} as const;

const WEEK_START_OPTIONS = ["locale", ...WEEKDAY_KEYS] as const;
// moment locale ids look like "en", "en-gb", "zh-cn", "tzm-latn".
const LOCALE_ID = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/;

/** String or fallback; control characters removed and length capped. */
function str(v: unknown, fallback = "", max: number = LIMITS.path): string {
  if (typeof v !== "string") {
    return fallback;
  }
  // eslint-disable-next-line no-control-regex -- strip C0 controls and DEL from persisted strings
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}

export function sanitizeWeekStart(v: unknown): IWeekStartOption {
  return isOneOf(v, WEEK_START_OPTIONS) ? v : "locale";
}

/** Only well-formed moment locale ids reach `moment.locale()`. */
export function sanitizeLocale(v: unknown): ILocaleOverride {
  return typeof v === "string" && LOCALE_ID.test(v) ? (v) : "system-default";
}

function sanitizeWeekdayTemplates(raw: unknown): IWeekdayTemplates {
  const out: IWeekdayTemplates = { ...EMPTY_WEEKDAY_TEMPLATES };
  if (isRecord(raw)) {
    for (const key of WEEKDAY_KEYS) {
      out[key] = str(raw[key]).trim();
    }
  }
  return out;
}

function sanitizePeriodic(raw: unknown, g: Granularity, defaultEnabled: boolean): IPeriodicConfig {
  const r = isRecord(raw) ? raw : {};
  const folderLayout = sanitizeFolderLayout(r.folderLayout, r.yearFolders === true);
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaultEnabled,
    folder: str(r.folder).trim(),
    format: str(r.format, "", LIMITS.format).trim() || DEFAULT_FORMATS[g],
    template: str(r.template).trim(),
    folderLayout,
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
  const extRaw = ext as { folderLayout?: unknown; yearFolders?: unknown };
  const folderLayout = sanitizeFolderLayout(
    base.folderLayout ?? extRaw.folderLayout,
    extRaw.yearFolders === true,
  );
  return {
    enabled: base.enabled,
    folder: str(ext.folder, base.folder).trim(),
    format: str(ext.format, "", LIMITS.format).trim() || base.format || DEFAULT_FORMATS[g],
    template: str(ext.template, base.template).trim(),
    folderLayout,
  };
}

export function sanitizeRules(raw: unknown): ITemplateRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rules: ITemplateRule[] = [];
  for (const item of raw.slice(0, LIMITS.rules)) {
    if (!isRecord(item)) {
      continue;
    }
    const condition = sanitizeCondition(item.condition);
    if (!condition) {
      continue;
    }
    const appliesRaw = item.appliesTo;
    const appliesTo = Array.isArray(appliesRaw)
      ? GRANULARITY_LIST.filter((g) => appliesRaw.includes(g))
      : [];
    rules.push({
      id: str(item.id, "", 64) || newRuleId(),
      name: str(item.name, "", LIMITS.text),
      enabled: item.enabled !== false,
      condition,
      template: str(item.template).trim(),
      appliesTo: appliesTo.length ? appliesTo : ["day"],
    });
  }
  return rules;
}

export function sanitizeImportant(raw: unknown): ImportantDays {
  const out: ImportantDays = {};
  if (!isRecord(raw)) {
    return out;
  }
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isRecord(v)) {
      continue;
    }
    if (++count > LIMITS.importantDays) {
      break;
    }
    const events = sanitizeImportantEvents(v, k);
    if (!events.length) {
      continue;
    }
    out[k] = {
      color: sanitizeImportantColor(v.color),
      prepDays: clampPrepDays(Number(v.prepDays ?? 0)),
      events,
    };
  }
  return out;
}

/** Accept v2.8 single-title shape or v2.9 `events[]`; drop empty days. */
function sanitizeImportantEvents(d: Record<string, unknown>, date: string): IImportantEvent[] {
  const rawList = Array.isArray(d.events) ? d.events : null;
  const events: IImportantEvent[] = [];
  if (rawList) {
    for (const item of rawList) {
      if (!isRecord(item)) {
        continue;
      }
      events.push({
        id: sanitizeEventId(item.id, date, events.length),
        title: str(item.title, "", LIMITS.text),
      });
      if (events.length >= LIMITS.importantEventsPerDay) {
        break;
      }
    }
  } else if (typeof d.title === "string" || d.title === undefined) {
    // Pre-2.9: one title on the day object.
    events.push({
      id: sanitizeEventId(undefined, date, 0),
      title: str(d.title, "", LIMITS.text),
    });
  }
  return events;
}

export function sanitizeDismissedUpcoming(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const key = item.slice(0, LIMITS.dismissedKey);
    if (!/^[ih]:\d{4}-\d{2}-\d{2}:/.test(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(key);
    if (out.length >= LIMITS.dismissedUpcoming) {
      break;
    }
  }
  return out;
}

function sanitizeStatsView(raw: unknown): IStatsView {
  const r = isRecord(raw) ? raw : {};
  return {
    mode: r.mode === "charts" ? "charts" : "table",
    metric: isOneOf(r.metric, CHART_METRICS) ? r.metric : "words",
    kind: isOneOf(r.kind, CHART_KINDS) ? r.kind : "bar",
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
  configDir = "",
): { settings: ISettings; migratedFrom: number | null } {
  const defaults = makeDefaultSettings();
  if (!isRecord(raw)) {
    return { settings: defaults, migratedFrom: null };
  }
  const r = raw;
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
      folderLayout: "flat" as const,
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
    language: isOneOf(r.language, ["auto", "en", "ru"] as const) ? r.language : defaults.language,
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
    // v10 (2.9.0): multi-event days (via sanitizeImportant), dismiss set, upcoming filter.
    dismissedUpcoming: sanitizeDismissedUpcoming(r.dismissedUpcoming),
    upcomingFilter: sanitizeUpcomingFilter(r.upcomingFilter),
    hideUpcomingFilter: r.hideUpcomingFilter === true,
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
    menuPosition: isOneOf(r.menuPosition, MENU_POSITIONS) ? r.menuPosition : defaults.menuPosition,
    // v7 (2.6.0): new field; older data gets the full default menu.
    menuItems: sanitizeMenuItems(r.menuItems),
    // v8 (2.7.0): new field; menuPosition gains "hidden".
    random: sanitizeRandomPrefs(r.random),
    // v9 (2.8.0): new fields.
    startupTabPosition: r.startupTabPosition === "right" ? "right" : "left",
    dateFieldFormat: sanitizeDateFieldFormat(r.dateFieldFormat),
    missingFromOpenNote: r.missingFromOpenNote !== false,
    statsView: sanitizeStatsView(r.statsView),
    lastOrganize: sanitizeJournal(r.lastOrganize, configDir),
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

function sanitizeJournal(raw: unknown, configDir: string): IOrganizeJournal | null {
  if (!isRecord(raw) || !Array.isArray(raw.moves)) {
    return null;
  }
  const moves: IMove[] = [];
  for (const item of raw.moves.slice(0, MAX_JOURNAL_MOVES)) {
    if (!isRecord(item) || typeof item.from !== "string" || typeof item.to !== "string") {
      continue;
    }
    const from = sanitizeVaultPath(item.from, configDir);
    const to = sanitizeVaultPath(item.to, configDir);
    if (from && to && from.endsWith(".md") && to.endsWith(".md")) {
      moves.push({ from, to, year: str(item.year, "", 4) });
    }
  }
  return moves.length ? { at: str(raw.at, "", 40), moves } : null;
}

/** Pick the config of a note type. */
export function periodicConfig(settings: ISettings, g: Granularity): IPeriodicConfig {
  const cfg = g === "day" ? settings.daily : g === "week" ? settings.weekly : settings.monthly;
  return cfg || defaultPeriodic(g, g === "day");
}


/** Effective daily-folder layout (defaults to flat). */
export function dailyFolderLayout(cfg: IPeriodicConfig): DailyFolderLayout {
  return sanitizeFolderLayout(cfg.folderLayout);
}
