import type { Moment } from "moment";
import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";
import { get } from "svelte/store";

import { getDayMarks } from "src/core/important";

import { settings } from "src/ui/stores";

/**
 * Marks important days (class `cwt-important`, attribute
 * `data-cwt-important=<color>`) and the "get ready" window before them
 * (class `cwt-prepare`, attribute `data-cwt-prepare=<color>`).
 */
export const importantDaysSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const s = get(settings);
    if (s.showImportantMarks === false) {
      return { classes: [], dots: [] }; // display only; rules / upcoming unaffected
    }
    const marks = getDayMarks(window.moment, date, s.importantDays);
    const classes: string[] = [];
    const dataAttributes: Record<string, string> = {};
    if (marks.important) {
      classes.push("cwt-important");
      dataAttributes["data-cwt-important"] = marks.important.color;
    } else if (marks.preparingFor.length) {
      const nearest = marks.preparingFor[0];
      classes.push("cwt-prepare");
      dataAttributes["data-cwt-prepare"] = nearest.day.color;
    }
    return { classes, dataAttributes, dots: [] };
  },
  getWeeklyMetadata: async (): Promise<IDayMetadata> => ({ classes: [], dots: [] }),
};
