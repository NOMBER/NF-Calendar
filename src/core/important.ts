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
const EVENT_ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;

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

/** One event on an important day (v2.9: several per day, shared colour). */
export interface IImportantEvent {
  id: string;
  title: string;
}

export interface IImportantDay {
  color: ImportantColor;
  /** Highlight this many days before the date (0..30). Shared for the day. */
  prepDays: number;
  /** One or more events on this day (same outline colour). */
  events: IImportantEvent[];
}

export type ImportantDays = Record<string, IImportantDay>;

export const MAX_PREP_DAYS = 30;
export const MAX_EVENTS_PER_DAY = 20;

export function clampPrepDays(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(MAX_PREP_DAYS, Math.max(0, Math.round(n)));
}

export function dayKey(date: Moment): string {
  return date.format("YYYY-MM-DD");
}

/** Random id for a newly added event (UI). Sanitization rewrites unsafe ids. */
export function newEventId(): string {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeEventId(raw: unknown, date: string, index: number): string {
  if (typeof raw === "string" && EVENT_ID_RE.test(raw)) {
    return raw;
  }
  return `e-${date}-${index}`;
}

/** Titles joined for tooltips / aria; empty → "". */
export function dayTitle(day: IImportantDay | null | undefined): string {
  if (!day?.events?.length) {
    return "";
  }
  return day.events
    .map((e) => (e.title || "").trim())
    .filter(Boolean)
    .join(", ");
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

export interface IUpcoming {
  date: string;
  day: IImportantDay;
  event: IImportantEvent;
  daysLeft: number;
}

/** Important events from today (inclusive) up to `horizonDays` ahead, sorted; one row per event. */
export function upcomingImportantDays(
  moment: MomentFactory,
  today: Moment,
  days: ImportantDays | null | undefined,
  horizonDays: number,
  limit = 40,
): IUpcoming[] {
  const list: IUpcoming[] = [];
  for (const [k, day] of Object.entries(days || {})) {
    if (!day?.events?.length) {
      continue;
    }
    const left = daysBetween(moment, today, k);
    if (!(Number.isFinite(left) && left >= 0 && left <= horizonDays)) {
      continue;
    }
    for (const event of day.events) {
      list.push({ date: k, day, event, daysLeft: left });
    }
  }
  list.sort(
    (a, b) =>
      a.daysLeft - b.daysLeft ||
      a.date.localeCompare(b.date) ||
      a.event.id.localeCompare(b.event.id),
  );
  return list.slice(0, limit);
}

/** All important events sorted by date (for the "important days" list). */
export function allImportantEvents(days: ImportantDays | null | undefined): Array<{
  date: string;
  day: IImportantDay;
  event: IImportantEvent;
}> {
  const list: Array<{ date: string; day: IImportantDay; event: IImportantEvent }> = [];
  for (const [date, day] of Object.entries(days || {})) {
    if (!day?.events?.length) {
      continue;
    }
    for (const event of day.events) {
      list.push({ date, day, event });
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id));
}

/** @deprecated use allImportantEvents — kept for callers that only need dates. */
export function allImportantDays(days: ImportantDays | null | undefined): Array<{
  date: string;
  day: IImportantDay;
}> {
  return Object.entries(days || {})
    .filter(([, day]) => day?.events?.length)
    .map(([date, day]) => ({ date, day }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove one event from a day; returns null if the day should be deleted. */
export function removeEventFromDay(day: IImportantDay, eventId: string): IImportantDay | null {
  const events = day.events.filter((e) => e.id !== eventId);
  if (!events.length) {
    return null;
  }
  return { ...day, events };
}

export function emptyImportantDay(): IImportantDay {
  return { color: "red", prepDays: 0, events: [{ id: newEventId(), title: "" }] };
}

/** Dismiss-key helpers for the upcoming list (user marks + holidays). */
export function importantDismissKey(date: string, eventId: string): string {
  return `i:${date}:${eventId}`;
}

export function holidayDismissKey(date: string, path: string): string {
  return `h:${date}:${path}`;
}

export function isDismissed(set: readonly string[] | null | undefined, key: string): boolean {
  return !!set && set.includes(key);
}

export type UpcomingFilter = "all" | "holidays" | "important";
export const UPCOMING_FILTERS: readonly UpcomingFilter[] = ["all", "holidays", "important"];

export function sanitizeUpcomingFilter(v: unknown): UpcomingFilter {
  return (UPCOMING_FILTERS as readonly unknown[]).includes(v) ? (v as UpcomingFilter) : "all";
}

/**
 * Effective filter for the upcoming list. When the control is hidden, always "all"
 * (saved preference is kept separately).
 */
export function resolveUpcomingFilter(
  saved: unknown,
  hideControl: boolean,
): UpcomingFilter {
  if (hideControl) {
    return "all";
  }
  return sanitizeUpcomingFilter(saved);
}

/** i18n key for a filter value (button label / menu item). */
export function upcomingFilterLabelKey(
  filter: UpcomingFilter,
): "upcoming.filterAll" | "upcoming.filterHolidays" | "upcoming.filterImportant" {
  if (filter === "holidays") {
    return "upcoming.filterHolidays";
  }
  if (filter === "important") {
    return "upcoming.filterImportant";
  }
  return "upcoming.filterAll";
}
