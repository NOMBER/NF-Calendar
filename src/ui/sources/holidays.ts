import type { Moment } from "moment";
import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";

import { get } from "svelte/store";

import { holidaysFor } from "src/io/holidays";
import { settings } from "src/ui/stores";

/**
 * Days with holidays from the holidays folder get class `cwt-holiday`
 * (CSS draws the 🎉 mark) and `data-cwt-holiday` with the count.
 * Reads the cached index only.
 */
export const holidaysSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    // Display switch only: the index, rules, stats and "Upcoming" still use holidays.
    const list = get(settings).showHolidayMarks === false ? [] : holidaysFor(date);
    if (!list.length) {
      return { classes: [], dots: [] };
    }
    return {
      classes: ["cwt-holiday"],
      dataAttributes: { "data-cwt-holiday": String(list.length) },
      dots: [],
    };
  },
  getWeeklyMetadata: async (): Promise<IDayMetadata> => ({ classes: [], dots: [] }),
};
