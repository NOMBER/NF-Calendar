/** Important days (pure helpers). Stored in data.json keyed by YYYY-MM-DD. */
import type { Moment } from "moment";

import type { MomentFactory } from "./dates";

export const IMPORTANT_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
] as const;
export type PresetColor = (typeof IMPORTANT_COLORS)[number];
/** A preset name or a custom `#rrggbb` (lower-case) from the colour picker. */
export type ImportantColor = PresetColor | `#${string}`;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isCustomColor(v: unknown): v is `#${string}` {
  return typeof v === "string" && HEX_COLOR.test(v);
}

/** Preset name, or validated hex normalized to lower case; anything else → "red". */
export function sanitizeImportantColor(v: unknown): ImportantColor {
  if ((IMPORTANT_COLORS as readonly unknown[]).includes(v)) {
    return v as PresetColor;
  }
  if (isCustomColor(v)) {
    return v.toLowerCase() as `#${string}`;
  }
  return "red";
}

export function hexToRgb(hex: string): [number, number, number] | null {
  if (!isCustomColor(hex)) {
    return null;
  }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * CSS rules for the custom colours in use, same variables as the presets
 * (`--cwt-c`, `--cwt-c-rgb`). Only validated hex values get in, so the
 * text is safe to put into a <style> element via textContent.
 */
export function customColorCss(days: ImportantDays): string {
  const seen = new Set<string>();
  for (const d of Object.values(days || {})) {
    const c = d && typeof d.color === "string" ? d.color.toLowerCase() : "";
    if (isCustomColor(c)) {
      seen.add(c);
    }
  }
  return [...seen]
    .sort()
    .map((c) => {
      const rgb = hexToRgb(c) as [number, number, number];
      const sel = ["color", "important", "prepare"].map((a) => `[data-cwt-${a}="${c}"]`).join(", ");
      return `${sel} { --cwt-c: ${c}; --cwt-c-rgb: ${rgb.join(", ")}; }`;
    })
    .join("\n");
}

export interface IImportantDay {
  title: string;
  color: ImportantColor;
  /** Highlight this many days before the date (0..30). */
  prepDays: number;
}

export type ImportantDays = Record<string, IImportantDay>;

export const MAX_PREP_DAYS = 30;

export function clampPrepDays(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(MAX_PREP_DAYS, Math.max(0, Math.round(n)));
}

export function dayKey(date: Moment): string {
  return date.format("YYYY-MM-DD");
}

export interface IPrepInfo {
  date: string;
  day: IImportantDay;
  daysLeft: number;
}

export interface IDayMarks {
  important: IImportantDay | null;
  /** Important days ahead whose preparation window covers this date, nearest first. */
  preparingFor: IPrepInfo[];
}

/** Whole days from `from` to `to` (calendar days, ignoring time). */
export function daysBetween(moment: MomentFactory, from: Moment, to: string): number {
  const target = moment(to, "YYYY-MM-DD", true);
  if (!target.isValid()) {
    return NaN;
  }
  const a = moment(from.format("YYYY-MM-DD"), "YYYY-MM-DD", true);
  return Math.round(target.diff(a, "days", true));
}

/**
 * Marks for one calendar day: is it itself important, and which upcoming
 * important days is it in the "get ready" window of (1..prepDays days before).
 */
export function getDayMarks(
  moment: MomentFactory,
  date: Moment,
  days: ImportantDays | null | undefined,
): IDayMarks {
  const key = dayKey(date);
  const important = days?.[key] ?? null;
  const preparingFor: IPrepInfo[] = [];
  for (const [k, day] of Object.entries(days || {})) {
    const prep = clampPrepDays(day?.prepDays ?? 0);
    if (!prep) {
      continue;
    }
    const left = daysBetween(moment, date, k);
    if (left >= 1 && left <= prep) {
      preparingFor.push({ date: k, day, daysLeft: left });
    }
  }
  preparingFor.sort((a, b) => a.daysLeft - b.daysLeft);
  return { important, preparingFor };
}

export interface IUpcoming extends IPrepInfo {}

/** Important days from today (inclusive) up to `horizonDays` ahead, sorted. */
export function upcomingImportantDays(
  moment: MomentFactory,
  today: Moment,
  days: ImportantDays | null | undefined,
  horizonDays: number,
  limit = 20,
): IUpcoming[] {
  const list: IUpcoming[] = [];
  for (const [k, day] of Object.entries(days || {})) {
    const left = daysBetween(moment, today, k);
    if (Number.isFinite(left) && left >= 0 && left <= horizonDays) {
      list.push({ date: k, day, daysLeft: left });
    }
  }
  list.sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
  return list.slice(0, limit);
}

/** All important days sorted by date (for the "important days" list). */
export function allImportantDays(days: ImportantDays | null | undefined): Array<{
  date: string;
  day: IImportantDay;
}> {
  return Object.entries(days || {})
    .map(([date, day]) => ({ date, day }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
