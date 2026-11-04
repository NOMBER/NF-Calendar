import type { Moment } from "moment";
import type { TFile } from "obsidian";
import type { ICalendarSource, IDayMetadata, IDot } from "obsidian-calendar-ui";
import { get } from "svelte/store";

import { getDailyNote, getWeeklyNote } from "src/core/dates";
import { dotsFor, modeNeedsContent, sanitizeDotsMode } from "src/core/dots";
import { countTasks, getWordCount } from "src/core/stats";
import { dailyNotes, settings, weeklyNotes } from "src/ui/stores";

/** Dots under a day; meaning is chosen in settings (`dotsMode`). */
export async function getDotsForNote(note: TFile | null): Promise<IDot[]> {
  const mode = sanitizeDotsMode(get(settings).dotsMode);
  if (!note || mode === "none") {
    return [];
  }
  let words = 0;
  let tasksDone = 0;
  let tasksOpen = 0;
  if (modeNeedsContent(mode)) {
    const text = await window.app.vault.cachedRead(note);
    if (mode === "words") {
      words = getWordCount(text);
    } else {
      const c = countTasks(text);
      tasksDone = c.done;
      tasksOpen = c.open;
    }
  }
  return dotsFor(mode, { exists: true, words, tasksDone, tasksOpen }).map((d) => ({
    color: "default",
    isFilled: d.isFilled,
    className: d.className ?? "",
  }));
}

export const dotsSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => ({
    dots: await getDotsForNote(getDailyNote(date, get(dailyNotes))),
  }),
  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => ({
    dots: await getDotsForNote(getWeeklyNote(date, get(weeklyNotes))),
  }),
};
