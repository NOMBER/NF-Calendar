/**
 * Placeholder substitution, same set as the core Daily Notes plugin /
 * obsidian-daily-notes-interface, relative to the NOTE date:
 *
 *   {{title}}, {{date}}, {{time}}
 *   {{date:FMT}}, {{time:FMT}}, {{date+1d:FMT}}, {{date-2w}} ...
 *   {{yesterday}}, {{tomorrow}}
 *   {{monday:FMT}} ... {{sunday:FMT}}  (day of the note's week, locale aware)
 *
 * Anything else (e.g. Templater's `<% ... %>`) is left untouched.
 */
import type { Moment } from "moment";

import { WEEKDAY_KEYS } from "./rules";
import type { WeekdayKey } from "./rules";

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
  now?: Moment
): string {
  const date = noteDate.clone();
  const current = (now || noteDate).clone();
  const filename = date.format(format);

  return contents
    .replace(/{{\s*date\s*}}/gi, filename)
    .replace(/{{\s*time\s*}}/gi, current.format("HH:mm"))
    .replace(/{{\s*title\s*}}/gi, filename)
    .replace(
      /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
      (_match, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
        const value = date.clone().set({
          hour: current.get("hour"),
          minute: current.get("minute"),
          second: current.get("second"),
        });
        if (calc) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value.add(parseInt(timeDelta, 10), unit as any);
        }
        if (momentFormat) {
          return value.format(momentFormat.substring(1).trim());
        }
        return value.format(format);
      }
    )
    .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
    .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "day").format(format))
    .replace(
      /{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi,
      (_match, dayOfWeek: string, momentFormat: string) => {
        const dayIndex = WEEKDAY_KEYS.indexOf(dayOfWeek.toLowerCase() as WeekdayKey);
        const firstDay = date.localeData().firstDayOfWeek();
        const localeIndex = (dayIndex - firstDay + 7) % 7;
        return date.clone().weekday(localeIndex).format(momentFormat.trim());
      }
    );
}

/** First `n` lines of a text (for the hover preview). */
export function firstLines(text: string, n: number): { lines: string[]; truncated: boolean } {
  const all = (text || "").split(/\r?\n/);
  return { lines: all.slice(0, n), truncated: all.length > n };
}
