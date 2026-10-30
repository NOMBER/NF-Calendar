import type { Moment } from "moment";
import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import {
  getAllDailyNotes,
  getDailyNote,
  getDailyNoteSettings,
} from "obsidian-daily-notes-interface";

import type { ISettings } from "src/settings";
import { createConfirmationDialog } from "src/ui/modal";

import {
  applyDailyTemplate,
  buildNotePath,
  parentFolders,
  selectDailyTemplate,
} from "./weekdayTemplates";

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";

interface IDailyNoteConfig {
  format: string;
  folder: string;
  template: string;
}

function getDailyConfig(): IDailyNoteConfig {
  const s = getDailyNoteSettings() || ({} as Partial<IDailyNoteConfig>);
  return {
    format: s.format || DEFAULT_DAILY_NOTE_FORMAT,
    folder: (s.folder || "").trim(),
    template: (s.template || "").trim(),
  };
}

async function ensureFolders(app: App, path: string): Promise<void> {
  for (const dir of parentFolders(path)) {
    const existing = app.vault.getAbstractFileByPath(dir);
    if (existing instanceof TFolder) {
      continue;
    }
    if (existing) {
      throw new Error(`'${dir}' exists and is not a folder`);
    }
    await app.vault.createFolder(dir);
  }
}

function resolveTemplateFile(app: App, templatePath: string): TFile | null {
  const p = normalizePath(templatePath);
  const direct = app.vault.getAbstractFileByPath(p);
  if (direct instanceof TFile) {
    return direct;
  }
  const withExt = app.vault.getAbstractFileByPath(`${p}.md`);
  if (withExt instanceof TFile) {
    return withExt;
  }
  return app.metadataCache.getFirstLinkpathDest(p.replace(/\.md$/, ""), "");
}

/**
 * Read the template that should be used for `date`.
 * Weekday template first, then the Daily Notes / Periodic Notes template.
 */
async function readTemplateFor(
  app: App,
  date: Moment,
  settings: ISettings,
  fallbackTemplate: string
): Promise<{ contents: string; file: TFile | null }> {
  const selection = selectDailyTemplate(date, settings, fallbackTemplate);
  if (selection.source === "none") {
    return { contents: "", file: null };
  }

  let file = resolveTemplateFile(app, selection.path);
  if (!file && selection.source === "weekday") {
    new Notice(
      `Calendar: weekday template '${selection.path}' not found. Using the default daily note template instead.`
    );
    if (fallbackTemplate) {
      file = resolveTemplateFile(app, fallbackTemplate);
    }
  }
  if (!file) {
    if (selection.source === "fallback") {
      new Notice(
        `Calendar: daily note template '${selection.path}' not found. Creating an empty note.`
      );
    }
    return { contents: "", file: null };
  }
  return { contents: await app.vault.read(file), file };
}

/**
 * Create the daily note for `date` using the weekday template (if any).
 * Returns the existing note if it already exists.
 */
export async function createDailyNoteWithWeekdayTemplate(
  app: App,
  date: Moment,
  settings: ISettings
): Promise<TFile | null> {
  const { format, folder, template } = getDailyConfig();
  const filename = date.format(format);
  const path = normalizePath(buildNotePath(folder, filename));

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return existing;
  }

  try {
    const { contents, file: templateFile } = await readTemplateFor(
      app,
      date,
      settings,
      template
    );
    const body = applyDailyTemplate(
      contents,
      date,
      format,
      window.moment()
    );
    await ensureFolders(app, path);
    const created = await app.vault.create(path, body);

    // Copy folding state from the template, like the core plugin does.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const foldManager = (app as any).foldManager;
      if (templateFile && foldManager?.load && foldManager?.save) {
        const foldInfo = foldManager.load(templateFile);
        if (foldInfo) {
          foldManager.save(created, foldInfo);
        }
      }
    } catch (_err) {
      // folding is cosmetic, ignore
    }
    return created;
  } catch (err) {
    console.error(`[Calendar] Failed to create daily note '${path}'`, err);
    new Notice(`Calendar: unable to create '${path}': ${err?.message ?? err}`);
    return null;
  }
}

function getLeaf(app: App, inNewSplit: boolean): WorkspaceLeaf {
  return inNewSplit ? app.workspace.getLeaf("split") : app.workspace.getLeaf(false);
}

/**
 * Create a Daily Note for a given date (asks for confirmation if enabled).
 */
export async function tryToCreateDailyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  cb?: (newFile: TFile) => void
): Promise<void> {
  const app = window.app;
  const { format } = getDailyConfig();
  const filename = date.format(format);

  const createFile = async () => {
    const dailyNote = await createDailyNoteWithWeekdayTemplate(
      app,
      date,
      settings
    );
    if (!dailyNote) {
      return;
    }
    const leaf = getLeaf(app, inNewSplit);
    await leaf.openFile(dailyNote, { active: true });
    cb?.(dailyNote);
  };

  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: "Create",
      onAccept: createFile,
      text: `File ${filename} does not exist. Would you like to create it?`,
      title: "New Daily Note",
    });
  } else {
    await createFile();
  }
}

/** Find the existing daily note for a date (null if none / folder missing). */
export function findDailyNote(date: Moment): TFile | null {
  try {
    return getDailyNote(date, getAllDailyNotes()) ?? null;
  } catch (_err) {
    return null;
  }
}

/** Open the daily note for `date`, creating it with the weekday template. */
export async function openOrCreateDailyNote(
  date: Moment,
  inNewSplit: boolean,
  settings: ISettings,
  existingFile: TFile | null,
  cb?: (file: TFile) => void
): Promise<void> {
  const app = window.app;
  if (!existingFile) {
    await tryToCreateDailyNote(date, inNewSplit, settings, cb);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mode = (app.vault as any).getConfig?.("defaultViewMode");
  const leaf = getLeaf(app, inNewSplit);
  await leaf.openFile(existingFile, {
    active: true,
    ...(mode ? { state: { mode } } : {}),
  });
  cb?.(existingFile);
}
