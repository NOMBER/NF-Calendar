/**
 * Pure helpers for per-weekday daily note templates.
 *
 * Nothing in this file touches the Obsidian API, so it can be unit-tested
 * with plain moment.js.
 */
import type { Moment } from "moment";

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

export type WeekdayKey = typeof WEEKDAY_KEYS[number];

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

export interface ITemplateSelectionSettings {
  useWeekdayTemplates: boolean;
  weekdayTemplates: Partial<IWeekdayTemplates>;
}

export interface ITemplateSelection {
  /** Template path to use ("" means: create an empty note). */
  path: string;
  /** Where the path came from. */
  source: "weekday" | "fallback" | "none";
  /** Weekday of the NOTE date (not of today). */
  weekday: WeekdayKey;
}

/**
 * Pick the template for a daily note.
 *
 * The weekday is taken from `noteDate` (the day that was clicked in the
 * calendar), never from the current date.
 */
export function selectDailyTemplate(
  noteDate: Moment,
  settings: ITemplateSelectionSettings,
  fallbackTemplate: string
): ITemplateSelection {
  const weekday = WEEKDAY_KEYS[noteDate.day()];
  const weekdayPath = settings?.useWeekdayTemplates
    ? (settings.weekdayTemplates?.[weekday] || "").trim()
    : "";

  if (weekdayPath) {
    return { path: weekdayPath, source: "weekday", weekday };
  }
  const fallback = (fallbackTemplate || "").trim();
  if (fallback) {
    return { path: fallback, source: "fallback", weekday };
  }
  return { path: "", source: "none", weekday };
}

/**
 * Order the weekday keys starting with the given first day of the week
 * (0 = Sunday, 1 = Monday, ...).
 */
export function orderedWeekdays(firstDayOfWeek: number): WeekdayKey[] {
  const start = ((firstDayOfWeek % 7) + 7) % 7;
  return WEEKDAY_KEYS.map((_, i) => WEEKDAY_KEYS[(start + i) % 7]);
}

/**
 * Replace the same placeholders that the core Daily Notes plugin /
 * obsidian-daily-notes-interface replace, relative to the NOTE date:
 *
 *   {{title}}, {{date}}, {{time}}
 *   {{date:FMT}}, {{time:FMT}}, {{date+1d:FMT}}, {{date-2w}} ...
 *   {{yesterday}}, {{tomorrow}}
 *   {{monday:FMT}} ... {{sunday:FMT}}  (day of the note's week, locale aware)
 *
 * Anything else (e.g. Templater's `<% ... %>`) is left untouched.
 *
 * @param contents   raw template text
 * @param noteDate   date of the note being created (will not be mutated)
 * @param format     daily note file name format
 * @param now        current time, used for {{time}} and as the time-of-day
 *                   part of {{date:...}} (defaults to noteDate)
 */
export function applyDailyTemplate(
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
    .replace(
      /{{\s*yesterday\s*}}/gi,
      date.clone().subtract(1, "day").format(format)
    )
    .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "day").format(format))
    .replace(
      /{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi,
      (_match, dayOfWeek: string, momentFormat: string) => {
        const dayIndex = WEEKDAY_KEYS.indexOf(
          dayOfWeek.toLowerCase() as WeekdayKey
        );
        const firstDay = date.localeData().firstDayOfWeek();
        const localeIndex = (dayIndex - firstDay + 7) % 7;
        return date.clone().weekday(localeIndex).format(momentFormat.trim());
      }
    );
}

/** Join a folder and a file name into a vault path ending in `.md`. */
export function buildNotePath(folder: string, filename: string): string {
  const name = filename.endsWith(".md") ? filename : `${filename}.md`;
  const cleanFolder = (folder || "").trim().replace(/^\/+|\/+$/g, "");
  const joined = cleanFolder ? `${cleanFolder}/${name}` : name;
  return joined.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\//, "");
}

/** All parent folders of a vault path, shortest first. */
export function parentFolders(path: string): string[] {
  const parts = path.split("/");
  parts.pop();
  const result: string[] = [];
  for (let i = 1; i <= parts.length; i++) {
    result.push(parts.slice(0, i).join("/"));
  }
  return result.filter((p) => p.length > 0);
}
