/**
 * Settings shape, defaults and migration (pure, no Obsidian API).
 */
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { DEFAULT_WORDS_PER_DOT } from "./constants";
import { DEFAULT_FORMATS } from "./core/dates";
import type { Granularity } from "./core/dates";
import { clampPrepDays, IMPORTANT_COLORS } from "./core/important";
import type { ImportantDays } from "./core/important";
import { EMPTY_WEEKDAY_TEMPLATES, newRuleId } from "./core/rules";
import type { ITemplateRule, IWeekdayTemplates } from "./core/rules";

export const SETTINGS_VERSION = 2;

export type Language = "auto" | "en" | "ru";

export interface IPeriodicConfig {
  enabled: boolean;
  folder: string;
  format: string;
  template: string;
}

export interface ISettings {
  settingsVersion: number;
  language: Language;

  wordsPerDot: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;
  localeOverride: ILocaleOverride;

  daily: IPeriodicConfig;
  weekly: IPeriodicConfig;
  monthly: IPeriodicConfig;

  useWeekdayTemplates: boolean;
  weekdayTemplates: IWeekdayTemplates;
  templateRules: ITemplateRule[];

  importantDays: ImportantDays;
  showUpcoming: boolean;
  upcomingCollapsed: boolean;
  upcomingHorizonDays: number;

  showTemplatePreview: boolean;
}

export function defaultPeriodic(g: Granularity, enabled: boolean): IPeriodicConfig {
  return { enabled, folder: "", format: DEFAULT_FORMATS[g], template: "" };
}

export function makeDefaultSettings(): ISettings {
  return {
    settingsVersion: SETTINGS_VERSION,
    language: "auto",
    wordsPerDot: DEFAULT_WORDS_PER_DOT,
    weekStart: "locale" as IWeekStartOption,
    shouldConfirmBeforeCreate: true,
    localeOverride: "system-default",
    daily: defaultPeriodic("day", true),
    weekly: defaultPeriodic("week", false),
    monthly: defaultPeriodic("month", false),
    useWeekdayTemplates: false,
    weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES },
    templateRules: [],
    importantDays: {},
    showUpcoming: true,
    upcomingCollapsed: false,
    upcomingHorizonDays: 60,
    showTemplatePreview: true,
  };
}

export const defaultSettings: ISettings = Object.freeze(makeDefaultSettings()) as ISettings;

/** Settings of other plugins, read only on explicit import (or v1 migration). */
export interface IExternalPeriodicSettings {
  daily?: Partial<IPeriodicConfig> | null;
  weekly?: Partial<IPeriodicConfig> | null;
  monthly?: Partial<IPeriodicConfig> | null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function sanitizePeriodic(
  raw: unknown,
  g: Granularity,
  defaultEnabled: boolean
): IPeriodicConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (raw || {}) as any;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaultEnabled,
    folder: str(r.folder).trim(),
    format: str(r.format).trim() || DEFAULT_FORMATS[g],
    template: str(r.template).trim(),
  };
}

/** Merge external settings into a config, keeping `enabled` as is. */
export function mergeExternal(
  base: IPeriodicConfig,
  ext: Partial<IPeriodicConfig> | null | undefined,
  g: Granularity
): IPeriodicConfig {
  if (!ext) {
    return base;
  }
  return {
    enabled: base.enabled,
    folder: str(ext.folder, base.folder).trim(),
    format: str(ext.format).trim() || base.format || DEFAULT_FORMATS[g],
    template: str(ext.template, base.template).trim(),
  };
}

function sanitizeRules(raw: unknown): ITemplateRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((r) => r && typeof r === "object" && r.condition)
    .map((r) => ({
      id: str(r.id) || newRuleId(),
      name: str(r.name),
      enabled: r.enabled !== false,
      condition: r.condition,
      template: str(r.template).trim(),
      appliesTo:
        Array.isArray(r.appliesTo) && r.appliesTo.length
          ? r.appliesTo.filter((g: string) => g === "day" || g === "week" || g === "month")
          : ["day"],
    }));
}

function sanitizeImportant(raw: unknown): ImportantDays {
  const out: ImportantDays = {};
  if (!raw || typeof raw !== "object") {
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") {
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = v as any;
    out[k] = {
      title: str(d.title),
      color: (IMPORTANT_COLORS as readonly string[]).includes(d.color) ? d.color : "red",
      prepDays: clampPrepDays(Number(d.prepDays ?? 0)),
    };
  }
  return out;
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
  externalForV1: IExternalPeriodicSettings = {}
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
      format: str(r.weeklyNoteFormat).trim() || DEFAULT_FORMATS.week,
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
    wordsPerDot:
      typeof r.wordsPerDot === "number" && Number.isFinite(r.wordsPerDot)
        ? r.wordsPerDot
        : defaults.wordsPerDot,
    weekStart: r.weekStart ?? defaults.weekStart,
    shouldConfirmBeforeCreate:
      typeof r.shouldConfirmBeforeCreate === "boolean"
        ? r.shouldConfirmBeforeCreate
        : defaults.shouldConfirmBeforeCreate,
    localeOverride: r.localeOverride ?? defaults.localeOverride,
    daily,
    weekly,
    monthly,
    useWeekdayTemplates: !!r.useWeekdayTemplates,
    weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES, ...(r.weekdayTemplates || {}) },
    templateRules: sanitizeRules(r.templateRules),
    importantDays: sanitizeImportant(r.importantDays),
    showUpcoming: typeof r.showUpcoming === "boolean" ? r.showUpcoming : defaults.showUpcoming,
    upcomingCollapsed: !!r.upcomingCollapsed,
    upcomingHorizonDays:
      typeof r.upcomingHorizonDays === "number" && r.upcomingHorizonDays > 0
        ? Math.min(366, Math.round(r.upcomingHorizonDays))
        : defaults.upcomingHorizonDays,
    showTemplatePreview:
      typeof r.showTemplatePreview === "boolean"
        ? r.showTemplatePreview
        : defaults.showTemplatePreview,
  };
  return { settings, migratedFrom: version < SETTINGS_VERSION ? version : null };
}

/** Pick the config of a note type. */
export function periodicConfig(settings: ISettings, g: Granularity): IPeriodicConfig {
  const cfg = g === "day" ? settings.daily : g === "week" ? settings.weekly : settings.monthly;
  return cfg || defaultPeriodic(g, g === "day");
}
