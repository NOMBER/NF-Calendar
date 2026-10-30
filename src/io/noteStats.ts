/** Read words / tasks of a note for the statistics modal. */
import type { App, TFile } from "obsidian";

import { countTasks, countTasksFromListItems, getWordCount } from "src/core/stats";
import type { ITaskCount } from "src/core/stats";

export interface INoteStats {
  words: number;
  tasksDone: number;
  tasksOpen: number;
}

/** Words from the file text; tasks from metadataCache when available. */
export async function computeNoteStats(app: App, file: TFile): Promise<INoteStats> {
  const text = await app.vault.cachedRead(file);
  const cache = app.metadataCache.getFileCache(file);
  const tasks = cache?.listItems ? countTasksFromListItems(cache.listItems) : countTasks(text);
  return { words: getWordCount(text), tasksDone: tasks.done, tasksOpen: tasks.open };
}

/** Tasks from metadataCache only (sync, no file read); zero when not cached. */
export function cachedTaskCount(app: App, file: TFile): ITaskCount {
  return countTasksFromListItems(app.metadataCache.getFileCache(file)?.listItems);
}
