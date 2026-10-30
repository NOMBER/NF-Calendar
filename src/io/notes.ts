/**
 * Own implementation of daily / weekly / monthly notes (replaces
 * obsidian-daily-notes-interface). Uses ONLY this plugin's settings.
 */
import type { Moment } from "moment";
import { Notice, TFile, TFolder, normalizePath } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";

import { DEFAULT_FORMATS, getDateUID, parseNoteDate } from "src/core/dates";
import type { Granularity } from "src/core/dates";
import { buildNotePath, parentFolders, relativeNotePath } from "src/core/paths";
import { applyTemplate } from "src/core/placeholders";
import { chooseTemplate } from "src/core/rules";
import type { ITemplateCandidate, ITemplateResolution } from "src/core/rules";
import { t } from "src/i18n";
import type { I18nKey } from "src/i18n";
import { periodicConfig } from "src/settingsData";
import type { ISettings } from "src/settingsData";
import { createConfirmationDialog } from "src/ui/modal";

export const GRANULARITIES: Granularity[] = ["day", "week", "month"];

export function typeLabel(g: Granularity): string {
  return t(`type.${g}` as I18nKey);
}

export function noteFormat(settings: ISettings, g: Granularity): string {
  return periodicConfig(settings, g).format || DEFAULT_FORMATS[g];
}

export function periodStart(date: Moment, g: Granularity): Moment {
  return date.clone().startOf(g);
}

export function getNotePath(date: Moment, settings: ISettings, g: Granularity): string {
  const cfg = periodicConfig(settings, g);
  const filename = periodStart(date, g).format(noteFormat(settings, g));
  return normalizePath(buildNotePath(cfg.folder, filename));
}

export function getDateFromFile(
  file: TFile | null,
  settings: ISettings,
  g: Granularity
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
export function getAllNotes(
  app: App,
  settings: ISettings,
  g: Granularity
): Record<string, TFile> {
  const index: Record<string, TFile> = {};
  const cfg = periodicConfig(settings, g);
  if (g !== "day" && !cfg.enabled) {
    return index;
  }
  for (const file of app.vault.getMarkdownFiles()) {
    const date = getDateFromFile(file, settings, g);
    if (date) {
      index[getDateUID(date, g)] = file;
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
  index?: Record<string, TFile> | null
): TFile | null {
  const byPath = app.vault.getAbstractFileByPath(getNotePath(date, settings, g));
  if (byPath instanceof TFile) {
    return byPath;
  }
  return index?.[getDateUID(date, g)] ?? null;
}

export function resolveTemplateFile(app: App, templatePath: string): TFile | null {
  if (!templatePath) {
    return null;
  }
  const p = normalizePath(templatePath);
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

/** Which template would be used for this note (no side effects). */
export function chooseTemplateFor(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity
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
    (path) => !!resolveTemplateFile(app, path)
  );
}

/** Human readable reason, e.g. `special rule "Holiday"`. */
export function describeCandidate(c: ITemplateCandidate | null): string {
  if (!c) {
    return t("source.none");
  }
  if (c.source === "rule") {
    return t("source.rule", { name: c.ruleName || "?" });
  }
  if (c.source === "weekday") {
    const idx = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
      c.weekday || ""
    );
    return t("source.weekday", { weekday: idx >= 0 ? window.moment.weekdays(idx) : c.weekday });
  }
  return t("source.default");
}

export interface IRenderedTemplate {
  contents: string;
  templateFile: TFile | null;
  resolution: ITemplateResolution;
}

/** Choose + read + substitute. Shows a Notice for every missing template file. */
export async function renderTemplateFor(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity,
  notifyMissing = true
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
  const contents = applyTemplate(
    raw,
    periodStart(date, g),
    noteFormat(settings, g),
    window.moment()
  );
  return { contents, templateFile, resolution };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foldManager = (app as any).foldManager;
    if (from && foldManager?.load && foldManager?.save) {
      const info = foldManager.load(from);
      if (info) {
        foldManager.save(to, info);
      }
    }
  } catch (_err) {
    // cosmetic only
  }
}

/**
 * Create the note for a date (returns the existing file if it is already
 * there). Returns null on error (a Notice is shown).
 */
export async function createNote(
  app: App,
  date: Moment,
  settings: ISettings,
  g: Granularity,
  notifyMissing = true
): Promise<TFile | null> {
  const path = getNotePath(date, settings, g);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    return existing;
  }
  try {
    const { contents, templateFile } = await renderTemplateFor(
      app,
      date,
      settings,
      g,
      notifyMissing
    );
    await ensureFolders(app, path);
    const created = await app.vault.create(path, contents);
    copyFolds(app, templateFile, created);
    return created;
  } catch (err) {
    console.error(`[Calendar] Failed to create note '${path}'`, err);
    new Notice(t("notice.createFailed", { path, error: err?.message ?? String(err) }));
    return null;
  }
}

function getLeaf(app: App, inNewSplit: boolean): WorkspaceLeaf {
  return inNewSplit ? app.workspace.getLeaf("split") : app.workspace.getLeaf(false);
}

export async function openFile(app: App, file: TFile, inNewSplit: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mode = (app.vault as any).getConfig?.("defaultViewMode");
  const leaf = getLeaf(app, inNewSplit);
  await leaf.openFile(file, { active: true, ...(mode ? { state: { mode } } : {}) });
}

/**
 * Open the note of a date; create it (optionally after confirmation) if it
 * does not exist.
 */
export async function openOrCreateNote(
  app: App,
  date: Moment,
  g: Granularity,
  settings: ISettings,
  inNewSplit: boolean,
  existing: TFile | null,
  cb?: (file: TFile) => void
): Promise<void> {
  const cfg = periodicConfig(settings, g);
  const file = existing ?? findNote(app, settings, date, g);
  if (file) {
    await openFile(app, file, inNewSplit);
    cb?.(file);
    return;
  }
  if (!cfg.enabled) {
    new Notice(t("notice.typeDisabled", { type: typeLabel(g) }));
    return;
  }
  const create = async () => {
    const created = await createNote(app, date, settings, g);
    if (created) {
      await openFile(app, created, inNewSplit);
      cb?.(created);
    }
  };
  if (settings.shouldConfirmBeforeCreate) {
    createConfirmationDialog({
      cta: t("confirm.create"),
      onAccept: create,
      text: t("confirm.text", { file: getNotePath(date, settings, g) }),
      title: t("confirm.title"),
    });
  } else {
    await create();
  }
}
