import type { App, TFile } from "obsidian";
import { get, writable } from "svelte/store";

import { getDateUID } from "src/core/dates";
import type { Granularity } from "src/core/dates";
import { defaultSettings } from "src/core/settings";
import type { ISettings } from "src/core/settings";
import { getAllNotes, getDateFromFile } from "src/io/notes";

export const settings = writable<ISettings>(defaultSettings);

let pluginApp: App | null = null;

/** Remember the App instance so stores do not use the `window.app` global. */
export function bindApp(app: App): void {
  pluginApp = app;
}

export function getPluginApp(): App {
  if (!pluginApp) {
    throw new Error("NF-Calendar: App has not been bound yet");
  }
  return pluginApp;
}

function createNotesStore(granularity: Granularity) {
  const store = writable<Record<string, TFile>>({});
  return {
    reindex: () => {
      try {
        store.set(getAllNotes(getPluginApp(), get(settings), granularity));
      } catch {
        store.set({});
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
