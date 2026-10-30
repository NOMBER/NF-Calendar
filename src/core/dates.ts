/**
 * Pure date helpers (no Obsidian API). Everything takes moment objects or a
 * moment factory so that it can be unit-tested with plain moment.js.
 */
import type { Moment } from "moment";

export type Granularity = "day" | "week" | "month";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MomentFactory = (...args: any[]) => Moment;

export const DEFAULT_FORMATS: Record<Granularity, string> = {
  day: "YYYY-MM-DD",
  week: "gggg-[W]ww",
  month: "YYYY-MM",
};

/** Same UID scheme as obsidian-calendar-ui uses for `selectedId`. */
export function getDateUID(date: Moment, granularity: Granularity = "day"): string {
  const ts = date.clone().startOf(granularity).format();
  return `${granularity}-${ts}`;
}

export function getNoteForDate<T>(
  date: Moment,
  index: Record<string, T> | null | undefined,
  granularity: Granularity
): T | null {
  if (!index) {
    return null;
  }
  return index[getDateUID(date, granularity)] ?? null;
}

export function getDailyNote<T>(date: Moment, index: Record<string, T>): T | null {
  return getNoteForDate(date, index, "day");
}

export function getWeeklyNote<T>(date: Moment, index: Record<string, T>): T | null {
  return getNoteForDate(date, index, "week");
}

function removeEscapedCharacters(format: string): string {
  return format.replace(/\[[^\]]*\]/g, "");
}

function parseStrict(
  moment: MomentFactory,
  text: string,
  format: string,
  granularity: Granularity
): Moment | null {
  const parsed = moment(text, format, true);
  if (!parsed.isValid()) {
    return null;
  }
  if (granularity === "week") {
    // Moment ignores week numbers when the format also has month/day.
    const clean = removeEscapedCharacters(format);
    if (/w{1,2}/i.test(clean) && (/M{1,4}/.test(clean) || /D{1,4}/.test(clean))) {
      return moment(
        text,
        format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""),
        false
      );
    }
  }
  return parsed;
}

/**
 * Parse the date of a periodic note.
 *
 * @param relativePath path of the note relative to the configured folder,
 *                     without the `.md` extension (e.g. "2026/10/2026-10-30")
 */
export function parseNoteDate(
  moment: MomentFactory,
  relativePath: string,
  format: string,
  granularity: Granularity
): Moment | null {
  const fmt = format || DEFAULT_FORMATS[granularity];
  if (fmt.includes("/")) {
    const full = parseStrict(moment, relativePath, fmt, granularity);
    if (full) {
      return full;
    }
  }
  const basename = relativePath.split("/").pop() || "";
  const lastSegment = fmt.split("/").pop() || fmt;
  return parseStrict(moment, basename, lastSegment, granularity);
}

/**
 * All days from `from` (inclusive) to the end of its week / month (inclusive).
 * Week boundaries follow the moment locale (the plugin configures the
 * global locale with the user's "start week on" setting).
 */
export function datesUntilEndOf(from: Moment, unit: "week" | "month"): Moment[] {
  const start = from.clone().startOf("day");
  const end = from.clone().endOf(unit).startOf("day");
  return datesBetween(start, end);
}

/** Every day between two dates, both inclusive. Empty if `to` < `from`. */
export function datesBetween(from: Moment, to: Moment): Moment[] {
  const result: Moment[] = [];
  const cursor = from.clone().startOf("day");
  const last = to.clone().startOf("day");
  while (!cursor.isAfter(last, "day")) {
    result.push(cursor.clone());
    cursor.add(1, "day");
  }
  return result;
}

/** Days from today until the end of `displayedMonth` (or the whole month if it is in the future). */
export function datesForMonthFrom(today: Moment, displayedMonth: Moment): Moment[] {
  const monthStart = displayedMonth.clone().startOf("month");
  const monthEnd = displayedMonth.clone().endOf("month").startOf("day");
  const start = today.isAfter(monthStart, "day") ? today.clone() : monthStart;
  return datesBetween(start, monthEnd);
}

/** Keep only the dates for which `hasNote` returns false. */
export function missingDates(
  dates: Moment[],
  hasNote: (date: Moment) => boolean
): Moment[] {
  return dates.filter((d) => !hasNote(d));
}
