/**
 * Cached index of the holidays folder. Built once and rebuilt only when a
 * file inside the folder is created, renamed or deleted (or the holiday
 * settings change) — never on calendar render.
 */
import type { Moment } from "moment";
import { normalizePath } from "obsidian";
import type { App, TAbstractFile } from "obsidian";
import { get, writable } from "svelte/store";

import { buildHolidayIndex, holidaysOn } from "src/core/holidays";
import type { HolidayIndex, IHoliday } from "src/core/holidays";
import { sanitizeVaultPath } from "src/core/paths";
import type { ISettings } from "src/core/settings";

export interface IHolidayState {
  folder: string;
  index: HolidayIndex;
  unrecognized: string[];
}

export const holidayStore = writable<IHolidayState>({ folder: "", index: {}, unrecognized: [] });

export function holidaysFor(date: Moment): IHoliday[] {
  return holidaysOn(get(holidayStore).index, date);
}

/** Vault folder of the setting, or "" when off or unsafe. */
export function holidayFolderOf(settings: ISettings, configDir: string): string {
  const raw = (settings.holidaysFolder || "").trim();
  if (!raw) {
    return "";
  }
  const safe = sanitizeVaultPath(raw, configDir);
  return safe ? normalizePath(safe) : "";
}

export function isInFolder(path: string, folder: string): boolean {
  return !!folder && (path === folder || path.startsWith(`${folder}/`));
}

export function rebuildHolidays(app: App, settings: ISettings): void {
  const folder = holidayFolderOf(settings, app.vault.configDir);
  if (!folder) {
    holidayStore.set({ folder: "", index: {}, unrecognized: [] });
    return;
  }
  const files = app.vault
    .getFiles()
    .filter((f) => f.extension === "md" && isInFolder(f.path, folder))
    .map((f) => ({ path: f.path, basename: f.basename }));
  const { index, unrecognized } = buildHolidayIndex(files, {
    order: settings.holidayDateOrder,
    pattern: settings.holidayPattern,
  });
  holidayStore.set({ folder, index, unrecognized });
}

/** Does this vault event touch the holidays folder? */
export function touchesHolidays(file: TAbstractFile, oldPath?: string): boolean {
  const folder = get(holidayStore).folder;
  if (!folder) {
    return false;
  }
  return isInFolder(file.path, folder) || (!!oldPath && isInFolder(oldPath, folder));
}
