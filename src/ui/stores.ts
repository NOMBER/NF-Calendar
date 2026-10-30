import type { TFile } from "obsidian";
import { get, writable } from "svelte/store";

import { getDateUID } from "src/core/dates";
import type { Granularity } from "src/core/dates";
import { getAllNotes, getDateFromFile } from "src/io/notes";
import { defaultSettings } from "src/settingsData";
import type { ISettings } from "src/settingsData";

export const settings = writable<ISettings>(defaultSettings);

function createNotesStore(granularity: Granularity) {
  let hasError = false;
  const store = writable<Record<string, TFile>>({});
  return {
    reindex: () => {
      try {
        store.set(getAllNotes(window.app, get(settings), granularity));
        hasError = false;
      } catch (err) {
        if (!hasError) {
          console.log(`[Calendar] Failed to index ${granularity} notes`, err);
        }
        store.set({});
        hasError = true;
      }
    },
    ...store,
  };
}

export const dailyNotes = createNotesStore("day");
export const weeklyNotes = createNotesStore("week");
export const monthlyNotes = createNotesStore("month");

/** dateUID of a file if it is a daily or weekly note of this plugin. */
export function getDateUIDFromFile(file: TFile | null): string | null {
  if (!file) {
    return null;
  }
  const s = get(settings);
  let date = getDateFromFile(file, s, "day");
  if (date) {
    return getDateUID(date, "day");
  }
  date = getDateFromFile(file, s, "week");
  if (date) {
    return getDateUID(date, "week");
  }
  return null;
}

function createSelectedFileStore() {
  const store = writable<string>(null);
  return {
    setFile: (file: TFile) => {
      store.set(getDateUIDFromFile(file));
    },
    ...store,
  };
}

export const activeFile = createSelectedFileStore();
