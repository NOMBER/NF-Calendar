/**
 * Vault access for daily / weekly / monthly notes (replaces
 * obsidian-daily-notes-interface). Uses ONLY this plugin's settings.
 *
 * Safety rules enforced here:
 *  - every note / template path goes through core/paths (stays in the vault);
 *  - an existing note is never overwritten by createNote;
 *  - concurrent createNote calls for the same path share one promise.
 */
import type { Moment } from "moment";
import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import { errorMessage } from "src/core/unknown";

import { DEFAULT_FORMATS, getDateUID, parseNoteDate } from "src/core/dates";
import type { Granularity } from "src/core/dates";
import { t } from "src/core/i18n";
import { notePathCandidates, periodMonth, periodYear, preferNotePath } from "src/core/organize";
import { dailyFolderLayout } from "src/core/settings";
import { buildNotePath, parentFolders, relativeNotePath, sanitizeVaultPath } from "src/core/paths";
import { applyTemplate, usesCarryover } from "src/core/placeholders";
import { dayKey } from "src/core/important";
import { chooseTemplate } from "src/core/rules";
import type { IRuleContext } from "src/core/rules";
import type { ITemplateResolution } from "src/core/rules";
import { periodicConfig } from "src/core/settings";
import type { ISettings } from "src/core/settings";
import { extractOpenTasks } from "src/core/stats";
import { holidaysFor } from "src/io/holidays";

export const GRANULARITIES: Granularity[] = ["day", "week", "month"];

/** How far back {{carryover}} looks for the previous daily note. */
const CARRYOVER_LOOKBACK_DAYS = 31;

export function noteFormat(settings: ISettings, g: Granularity): string {
  return periodicConfig(settings, g).format || DEFAULT_FORMATS[g];
}

export function periodStart(date: Moment, g: Granularity): Moment {
  return date.clone().startOf(g);
}

/**
 * Vault path of the note for a date, or null if folder + format would
 * produce a path outside the vault (e.g. "../" in the folder or format).
 */
export function getNotePath(
  date: Moment,
  settings: ISettings,
  g: Granularity,
  configDir?: string,
): string | null {
  return notePaths(date, settings, g, configDir)[0] ?? null;
}

/**
 * All paths where the note for a date may live, best first: the expected
 * one (with `<YYYY>/` if year folders are on), then the other layout.
 * Single source of truth for "where is / where goes the note of this date".
 */
export function notePaths(
  date: Moment,
  settings: ISettings,
  g: Granularity,
  configDir?: string,
): string[] {
  const cfg = periodicConfig(settings, g);
  const filename = periodStart(date, g).format(noteFormat(settings, g));
  if (!buildNotePath(cfg.folder, filename, configDir)) {
    return [];
  }
  return notePathCandidates(
    cfg.folder,
    filename,
    periodYear(date, g),
    dailyFolderLayout(cfg),
    configDir,
    periodMonth(date),
  ).map((p) => normalizePath(p));
}

export function getDateFromFile(
  file: TFile | null,
  settings: ISettings,
  g: Granularity,
): Moment | null {
  if (!file || !settings) {
    return null;
  }
  const cfg = periodicConfig(settings, g);
  if (g !== "day" && !cfg.enabled) {
    return null;
  }
  const rel = relativeNotePath(file.path, cfg.folder);
  if (rel === null) {
    return null;
  }
  return parseNoteDate(window.moment, rel, noteFormat(settings, g), g);
}

/** Index of all notes of a type: dateUID -> file. */
export function getAllNotes(app: App, settings: ISettings, g: Granularity): Record<string, TFile> {
  const index: Record<string, TFile> = {};
  const cfg = periodicConfig(settings, g);
  if (g !== "day" && !cfg.enabled) {
    return index;
  }
  for (const file of app.vault.getMarkdownFiles()) {
    const date = getDateFromFile(file, settings, g);
    if (date) {
      const uid = getDateUID(date, g);
      const prev = index[uid];
      // Duplicates (flat + year folder): keep the one at the expected path,
      // never "whichever the vault listed last".
      index[uid] =
        prev &&
        preferNotePath(prev.path, file.path, notePaths(date, settings, g, app.vault.configDir)) ===
          prev.path
          ? prev
          : file;
    }
  }
  return index;
}

/** Existing note for a date: exact path first, then the index (if given). */
export function findNote(
  app: App,
  settings: ISettings,
  date: Moment,
  g: Granularity,
  index?: Record<string, TFile> | null,
): TFile | null {
  for (const path of notePaths(date, settings, g, app.vault.configDir)) {
    const byPath = app.vault.getAbstractFileByPath(path);
    if (byPath instanceof TFile) {
      return byPath;
    }
  }
  // Any other year folder / layout inside the configured folder.
  const uid = getDateUID(date, g);
  return (index ?? getAllNotes(app, settings, g))[uid] ?? null;
}

export function resolveTemplateFile(app: App, templatePath: string): TFile | null {
  const safe = templatePath ? sanitizeVaultPath(templatePath, app.vault.configDir) : null;
  if (!safe) {
    return null;
  }
  const p = normalizePath(safe);
  const direct = app.vault.getAbstractFileByPath(p);
  if (direct instanceof TFile) {
    return direct;
  }
  const withExt = app.vault.getAbstractFileByPath(`${p}.md`);
  if (withExt instanceof TFile) {
    return withExt;
  }
  return app.metadataCache.getFirstLinkpathDest(p.replace(/\.md$/, ""), "") ?? null;
}

/** Day facts the holiday / important rule types need. */
export function ruleContext(settings: ISettings): IRuleContext {
  return {
    isHoliday: (date) => holidaysFor(date).length > 0,
    isImportant: (date) => !!settings.importantDays?.[dayKey(date)],
  };
}

/** Which template would be used for this note (no side effects). */
export function chooseTemplateFor(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity,
): ITemplateResolution {
  return chooseTemplate(
    periodStart(date, g),
    {
      templateRules: settings.templateRules,
      useWeekdayTemplates: settings.useWeekdayTemplates,
      weekdayTemplates: settings.weekdayTemplates,
      defaultTemplate: periodicConfig(settings, g).template,
    },
    g,
    (path) => !!resolveTemplateFile(app, path),
    ruleContext(settings),
  );
}

export interface IRenderedTemplate {
  contents: string;
  templateFile: TFile | null;
  resolution: ITemplateResolution;
}

export interface IRenderOptions {
  /** Show a Notice for every missing template file (default true). */
  notifyMissing?: boolean;
  /**
   * Fill {{carryover}} from the previous daily note (default true). Batch
   * creation turns it off, otherwise the same open tasks would be copied
   * into every future note; {{carryover}} then becomes empty.
   */
  carryover?: boolean;
}

/** Choose + read + substitute. */
export async function renderTemplateFor(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity,
  { notifyMissing = true, carryover: withCarryover = true }: IRenderOptions = {},
): Promise<IRenderedTemplate> {
  const resolution = chooseTemplateFor(app, date, settings, g);
  if (notifyMissing) {
    for (const m of resolution.missing) {
      new Notice(t("notice.templateMissing", { path: m.path }));
    }
  }
  let raw = "";
  let templateFile: TFile | null = null;
  if (resolution.chosen) {
    templateFile = resolveTemplateFile(app, resolution.chosen.path);
    raw = templateFile ? await app.vault.read(templateFile) : "";
  }
  const carryover =
    withCarryover && g === "day" && usesCarryover(raw)
      ? await readCarryover(app, date, settings)
      : undefined;
  const contents = applyTemplate(
    raw,
    periodStart(date, g),
    noteFormat(settings, g),
    window.moment(),
    {
      carryover,
    },
  );
  return { contents, templateFile, resolution };
}

/** Open tasks of the closest earlier daily note (read only, never modified). */
async function readCarryover(app: App, date: Moment, settings: ISettings): Promise<string> {
  const index = getAllNotes(app, settings, "day");
  const day = date.clone().startOf("day");
  for (let i = 1; i <= CARRYOVER_LOOKBACK_DAYS; i++) {
    const previous = findNote(app, settings, day.clone().subtract(i, "day"), "day", index);
    if (previous) {
      return extractOpenTasks(await app.vault.cachedRead(previous)).join("\n");
    }
  }
  return "";
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

function copyFolds(app: App, from: TFile | null, to: TFile): void {
  try {
    const foldManager = app.foldManager;
    if (from && foldManager?.load && foldManager?.save) {
      const info = foldManager.load(from);
      if (info) {
        foldManager.save(to, info);
      }
    }
  } catch {
    // cosmetic only
  }
}

// Path -> pending creation. Two quick clicks (or a click during a batch run)
// must not both call vault.create for the same file.
const inFlight = new Map<string, Promise<TFile | null>>();

/**
 * Create the note for a date. Never overwrites: if the file already exists
 * it is returned unchanged. Returns null on error (a Notice is shown).
 */
export function createNote(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity,
  options: IRenderOptions = {},
): Promise<TFile | null> {
  const path = getNotePath(date, settings, g, app.vault.configDir);
  if (!path) {
    const cfg = periodicConfig(settings, g);
    new Notice(
      t("notice.unsafePath", { folder: cfg.folder || "/", format: noteFormat(settings, g) }),
    );
    return Promise.resolve(null);
  }
  const pending = inFlight.get(path);
  if (pending !== undefined) {
    return pending;
  }
  const job = createAt(app, path, date, settings, g, options).finally(() => inFlight.delete(path));
  inFlight.set(path, job);
  return job;
}

async function createAt(
  app: App,
  path: string,
  date: Moment,
  settings: ISettings,
  g: Granularity,
  options: IRenderOptions,
): Promise<TFile | null> {
  // Wait until Obsidian has loaded the vault: before that the file cache may
  // not know the organized notes yet.
  await layoutReady(app);
  try {
    const existing = await findExistingOnDisk(app, settings, date, g);
    if (existing) {
      return existing;
    }
    const { contents, templateFile } = await renderTemplateFor(app, date, settings, g, options);
    // The template read is async: re-check so a file created meanwhile wins.
    const raced = await findExistingOnDisk(app, settings, date, g);
    if (raced) {
      return raced;
    }
    if (await app.vault.adapter.exists(path)) {
      // On disk but not in the cache yet: never overwrite, never duplicate.
      throw new Error(`'${path}' already exists`);
    }
    await ensureFolders(app, path);
    const created = await app.vault.create(path, contents);
    copyFolds(app, templateFile, created);
    return created;
  } catch (err) {
    console.error(`[Calendar] Failed to create note '${path}'`, err);
    new Notice(t("notice.createFailed", { path, error: errorMessage(err) }));
    return null;
  }
}

function layoutReady(app: App): Promise<void> {
  if (app.workspace.layoutReady) {
    return Promise.resolve();
  }
  return new Promise((resolve) => app.workspace.onLayoutReady(() => resolve()));
}

/**
 * Last check right before creating: every candidate path straight on disk
 * (adapter, not only the cache), then a fresh scan of the whole folder
 * (any year subfolder).
 */
async function findExistingOnDisk(
  app: App,
  settings: ISettings,
  date: Moment,
  g: Granularity,
): Promise<TFile | null> {
  for (const path of notePaths(date, settings, g, app.vault.configDir)) {
    const cached = app.vault.getAbstractFileByPath(path);
    if (cached instanceof TFile) {
      return cached;
    }
    if (await app.vault.adapter.exists(path)) {
      throw new Error(`'${path}' exists on disk but is not indexed yet; try again in a moment`);
    }
  }
  return getAllNotes(app, settings, g)[getDateUID(date, g)] ?? null;
}

function getLeaf(app: App, inNewSplit: boolean): WorkspaceLeaf {
  return inNewSplit ? app.workspace.getLeaf("split") : app.workspace.getLeaf(false);
}

export async function openFile(app: App, file: TFile, inNewSplit: boolean): Promise<void> {
  const mode = app.vault.getConfig?.("defaultViewMode");
  const leaf = getLeaf(app, inNewSplit);
  const state = typeof mode === "string" && mode ? { mode } : undefined;
  await leaf.openFile(file, { active: true, ...(state ? { state } : {}) });
}
