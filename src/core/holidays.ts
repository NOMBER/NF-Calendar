/**
 * Holidays from a vault folder (pure, no Obsidian API).
 *
 * A holiday note is any file whose name STARTS with a date, followed by the
 * holiday name, e.g. "08.03 Women's day", "12-25 Christmas",
 * "2024-05-09 Victory day". Matching is yearly: only day and month count.
 */
import type { Moment } from "moment";

import { isValidMonthDay } from "./rules";

export type HolidayDateOrder = "dayFirst" | "monthFirst";

export interface IHoliday {
  /** MM-DD */
  monthDay: string;
  name: string;
  path: string;
  /** Year from a YYYY-MM-DD name, if any (used for ages / anniversaries). */
  year?: number;
}

/** Years below this are "placeholder" years (e.g. 1000-09-01): no age shown. */
export const MIN_REAL_YEAR = 1900;

/** Age / anniversary on `date`, or null for missing or placeholder years. */
export function holidayAge(h: { year?: number }, date: Moment): number | null {
  if (!h.year || h.year < MIN_REAL_YEAR) {
    return null;
  }
  const age = date.year() - h.year;
  return age >= 0 ? age : null;
}

export interface IHolidayOptions {
  order: HolidayDateOrder;
  /** Optional custom date format at the start of the name (tokens DD D MM M YYYY). */
  pattern?: string;
}

export type HolidayIndex = Record<string, IHoliday[]>;

const pad = (n: number) => String(n).padStart(2, "0");

function monthDayOf(month: number, day: number): string | null {
  const md = `${pad(month)}-${pad(day)}`;
  return isValidMonthDay(md) ? md : null;
}

/** Strip separators between the date and the name. */
function cleanName(rest: string): string {
  return rest.replace(/^[\s\-–—_.,:;|]+/, "").trim();
}

const MAX_PATTERN = 24;

/**
 * Compile a custom pattern ("DD.MM", "YYYY_MM_DD", "D MM") into a regex.
 * Only the tokens YYYY, MM, M, DD, D are special; every other character is
 * matched literally (escaped), so user input can never build a dangerous
 * regex. Returns null when the pattern is too long or lacks day / month.
 */
export function compileHolidayPattern(
  pattern: string,
): { regex: RegExp; groups: Array<"year" | "month" | "day"> } | null {
  const p = (pattern || "").trim();
  if (!p || p.length > MAX_PATTERN) {
    return null;
  }
  const groups: Array<"year" | "month" | "day"> = [];
  let src = "^";
  let i = 0;
  while (i < p.length) {
    const rest = p.slice(i);
    const token = ["YYYY", "MM", "DD", "M", "D"].find((tk) => rest.startsWith(tk));
    if (token) {
      const kind = token[0] === "Y" ? "year" : token[0] === "M" ? "month" : "day";
      if (groups.includes(kind)) {
        return null;
      }
      groups.push(kind);
      src += token === "YYYY" ? "(\\d{4})" : token.length === 2 ? "(\\d{2})" : "(\\d{1,2})";
      i += token.length;
    } else {
      src += p[i].replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");
      i++;
    }
  }
  if (!groups.includes("month") || !groups.includes("day")) {
    return null;
  }
  return { regex: new RegExp(src), groups };
}

export function isValidHolidayPattern(pattern: string): boolean {
  return !pattern.trim() || compileHolidayPattern(pattern) !== null;
}

/**
 * Parse a file name (without extension). Recognized starts:
 *   YYYY-MM-DD (also with . or /), then two-part dates DD.MM / DD-MM / DD/MM
 *   or MM-DD... read in the configured `order` (day first by default).
 */
export function parseHolidayName(
  basename: string,
  opts: IHolidayOptions,
): { monthDay: string; name: string; year?: number } | null {
  const text = (basename || "").trim();
  if (opts.pattern && opts.pattern.trim()) {
    const compiled = compileHolidayPattern(opts.pattern);
    if (!compiled) {
      return null;
    }
    const match = compiled.regex.exec(text);
    if (!match) {
      return null;
    }
    const get = (k: "month" | "day") => Number(match[compiled.groups.indexOf(k) + 1]);
    const md = monthDayOf(get("month"), get("day"));
    const yi = compiled.groups.indexOf("year");
    const year = yi >= 0 ? Number(match[yi + 1]) : undefined;
    return md
      ? {
          monthDay: md,
          name: cleanName(text.slice(match[0].length)) || md,
          ...(year ? { year } : {}),
        }
      : null;
  }

  const full = /^(\d{4})([-./])(\d{1,2})\2(\d{1,2})(?!\d)/.exec(text);
  if (full) {
    const md = monthDayOf(Number(full[3]), Number(full[4]));
    return md
      ? { monthDay: md, name: cleanName(text.slice(full[0].length)) || md, year: Number(full[1]) }
      : null;
  }
  const short = /^(\d{1,2})([-./])(\d{1,2})(?![\d])/.exec(text);
  if (!short) {
    return null;
  }
  const a = Number(short[1]);
  const b = Number(short[3]);
  const md = opts.order === "monthFirst" ? monthDayOf(a, b) : monthDayOf(b, a);
  return md ? { monthDay: md, name: cleanName(text.slice(short[0].length)) || md } : null;
}

/** Build the MM-DD -> holidays index from file names. */
export function buildHolidayIndex(
  files: Array<{ path: string; basename: string }>,
  opts: IHolidayOptions,
): { index: HolidayIndex; unrecognized: string[] } {
  const index: HolidayIndex = {};
  const unrecognized: string[] = [];
  for (const f of files) {
    const parsed = parseHolidayName(f.basename, opts);
    if (!parsed) {
      unrecognized.push(f.path);
      continue;
    }
    (index[parsed.monthDay] ||= []).push({ ...parsed, path: f.path });
  }
  for (const list of Object.values(index)) {
    list.sort((x, y) => x.name.localeCompare(y.name));
  }
  return { index, unrecognized };
}

export function holidaysOn(index: HolidayIndex, date: Moment): IHoliday[] {
  return index[date.format("MM-DD")] || [];
}

export interface IUpcomingHoliday {
  date: Moment;
  daysLeft: number;
  holidays: IHoliday[];
}

/** Holidays from today (inclusive) up to `horizonDays` ahead. */
export function upcomingHolidays(
  index: HolidayIndex,
  today: Moment,
  horizonDays: number,
): IUpcomingHoliday[] {
  const result: IUpcomingHoliday[] = [];
  if (!Object.keys(index).length) {
    return result;
  }
  const start = today.clone().startOf("day");
  for (let i = 0; i <= horizonDays; i++) {
    const date = start.clone().add(i, "day");
    const list = holidaysOn(index, date);
    if (list.length) {
      result.push({ date, daysLeft: i, holidays: list });
    }
  }
  return result;
}
