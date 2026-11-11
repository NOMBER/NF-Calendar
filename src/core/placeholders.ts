/**
 * Placeholder substitution, same set as the core Daily Notes plugin /
 * obsidian-daily-notes-interface, relative to the NOTE date:
 *
 *   {{title}}, {{date}}, {{time}}
 *   {{date:FMT}}, {{time:FMT}}, {{date+1d:FMT}}, {{date-2w}} ...
 *   {{yesterday}}, {{tomorrow}}
 *   {{monday:FMT}} ... {{sunday:FMT}}  (day of the note's week, locale aware)
 *   {{carryover}}  open tasks of the previous daily note (see core/tasks)
 *
 * Anything else (e.g. Templater's `<% ... %>`) is left untouched.
 */
import type { Moment } from "moment";

import { WEEKDAY_KEYS } from "./rules";
import type { WeekdayKey } from "./rules";

/** Extra values that are not derived from the date. */
export interface ITemplateVars {
  /** Text for {{carryover}}; the placeholder is removed when undefined. */
  carryover?: string;
}

// Templates are user files, so keep the patterns linear (no nested
// quantifiers) and always use replacer functions: a "$&" in a date format
// must not be interpreted by String.replace.
const DATE_CALC = /{{\s*(date|time)\s*(?:([+-]\d{1,6})([yqmwdhs])\s*)?(?::([^}]*))?}}/gi;
const WEEKDAY = /{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:([^}]*)}}/gi;
const CARRYOVER = /{{\s*carryover\s*}}/gi;

const CALC_UNITS = ["y", "q", "m", "w", "d", "h", "s"] as const;
type CalcUnit = (typeof CALC_UNITS)[number];
function isCalcUnit(v: string): v is CalcUnit {
  return (CALC_UNITS as readonly string[]).includes(v);
}

/** Keep the original unit letters: moment treats "m" as minutes and "q" as quarter. */
function addCalcUnit(date: Moment, amount: number, unit: CalcUnit): void {
  switch (unit) {
    case "y":
      date.add(amount, "y");
      break;
    case "q":
      date.add(amount, "quarter");
      break;
    case "m":
      date.add(amount, "m");
      break;
    case "w":
      date.add(amount, "w");
      break;
    case "d":
      date.add(amount, "d");
      break;
    case "h":
      date.add(amount, "h");
      break;
    case "s":
      date.add(amount, "s");
      break;
  }
}


/**
 * @param contents raw template text
 * @param noteDate date of the note (first day of the period for week/month)
 * @param format   file name format of the note type
 * @param now      current time (for {{time}} and the time part of {{date:..}})
 */
export function applyTemplate(
  contents: string,
  noteDate: Moment,
  format: string,
  now?: Moment,
  vars: ITemplateVars = {},
): string {
  const date = noteDate.clone();
  const current = (now || noteDate).clone();
  const filename = date.format(format);
  const constant = (value: string) => () => value;

  const result = contents
    .replace(/{{\s*date\s*}}/gi, constant(filename))
    .replace(/{{\s*time\s*}}/gi, constant(current.format("HH:mm")))
    .replace(/{{\s*title\s*}}/gi, constant(filename))
    .replace(DATE_CALC, (_match, _kind, delta: string, unit: string, momentFormat: string) => {
      const value = date.clone().set({
        hour: current.get("hour"),
        minute: current.get("minute"),
        second: current.get("second"),
      });
      if (delta && isCalcUnit(unit)) {
        addCalcUnit(value, parseInt(delta, 10), unit);
      }
      const fmt = momentFormat?.trim();
      return value.format(fmt || format);
    })
    .replace(/{{\s*yesterday\s*}}/gi, constant(date.clone().subtract(1, "day").format(format)))
    .replace(/{{\s*tomorrow\s*}}/gi, constant(date.clone().add(1, "day").format(format)))
    .replace(WEEKDAY, (_match, dayOfWeek: string, momentFormat: string) => {
      const dayIndex = WEEKDAY_KEYS.indexOf(dayOfWeek.toLowerCase() as WeekdayKey);
      const firstDay = date.localeData().firstDayOfWeek();
      const localeIndex = (dayIndex - firstDay + 7) % 7;
      return date.clone().weekday(localeIndex).format(momentFormat.trim());
    });
  // Last, so placeholders inside carried-over text are not expanded.
  return result.replace(CARRYOVER, constant(vars.carryover ?? ""));
}

/** Does the template use {{carryover}}? (to skip reading the previous note otherwise) */
export function usesCarryover(contents: string): boolean {
  return new RegExp(CARRYOVER.source, "i").test(contents);
}

/** First `n` lines of a text (for the hover preview). */
export function firstLines(text: string, n: number): { lines: string[]; truncated: boolean } {
  const all = (text || "").split(/\r?\n/);
  return { lines: all.slice(0, n), truncated: all.length > n };
}
