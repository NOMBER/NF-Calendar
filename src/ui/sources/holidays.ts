import type { Moment } from "moment";
import type { ICalendarSource, IDayMetadata } from "obsidian-calendar-ui";

import { holidaysFor } from "src/io/holidays";

/**
 * Days with holidays from the holidays folder get class `cwt-holiday`
 * (CSS draws the 🎉 mark) and `data-cwt-holiday` with the count.
 * Reads the cached index only.
 */
export const holidaysSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const list = holidaysFor(date);
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
