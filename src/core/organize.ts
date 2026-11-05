/**
 * Organize daily notes into year (and optional month) subfolders, and resolve
 * note paths across flat / year / year-month layouts (pure).
 *
 * Layouts (under the daily folder):
 *   flat:        2026-11-05.md
 *   year:        2026/2026-11-05.md
 *   year-month:  2026/11/2026-11-05.md   (month = zero-padded "01"…"12")
 */
import type { Moment } from "moment";

import type { Granularity, MomentFactory } from "./dates";
import { parseNoteDate } from "./dates";
import { buildNotePath, cleanFolder, relativeNotePath } from "./paths";

export type DailyFolderLayout = "flat" | "year" | "year-month";
export const DAILY_FOLDER_LAYOUTS: readonly DailyFolderLayout[] = ["flat", "year", "year-month"];

export type SkipReason = "unparsed" | "conflict" | "inSubfolder" | "formatHasFolders" | "already";

export interface IMove {
  from: string;
  to: string;
  year: string;
  /** Zero-padded month when organizing into year-month; empty otherwise. */
  month?: string;
}

export interface ISkip {
  path: string;
  reason: SkipReason;
}

export interface IOrganizePlan {
  moves: IMove[];
  skipped: ISkip[];
  /** year -> number of moves (year-month: "2026/11" keys also appear in byYear as year only) */
  byYear: Record<string, number>;
  layout: DailyFolderLayout;
}

const YEAR_DIR = /^\d{4}$/;
const MONTH_DIR = /^(0[1-9]|1[0-2])$/;

export function sanitizeFolderLayout(v: unknown, yearFoldersFallback?: boolean): DailyFolderLayout {
  if (v === "year" || v === "year-month" || v === "flat") {
    return v;
  }
  return yearFoldersFallback ? "year" : "flat";
}

export function periodMonth(date: Moment): string {
  return String(date.month() + 1).padStart(2, "0");
}

/** Is this path inside `folder/<YYYY>/` directly (not a month subfolder)? */
export function isInYearFolder(path: string, folder: string): boolean {
  const rel = relativeNotePath(path, folder);
  if (rel === null) {
    return false;
  }
  const parts = rel.split("/");
  return parts.length === 2 && YEAR_DIR.test(parts[0]);
}

/** Is this path inside `folder/<YYYY>/<MM>/`? */
export function isInYearMonthFolder(path: string, folder: string): boolean {
  const rel = relativeNotePath(path, folder);
  if (rel === null) {
    return false;
  }
  const parts = rel.split("/");
  return parts.length === 3 && YEAR_DIR.test(parts[0]) && MONTH_DIR.test(parts[1]);
}

/** Build the organized path for a basename under a layout. */
export function organizedPath(
  folder: string,
  filename: string,
  year: string,
  layout: DailyFolderLayout,
  month: string,
  configDir?: string,
): string | null {
  if (filename.includes("/")) {
    return buildNotePath(cleanFolder(folder), filename, configDir);
  }
  const f = cleanFolder(folder);
  if (layout === "year-month") {
    const base = f ? `${f}/${year}/${month}` : `${year}/${month}`;
    return buildNotePath(base, filename, configDir);
  }
  if (layout === "year") {
    const base = f ? `${f}/${year}` : year;
    return buildNotePath(base, filename, configDir);
  }
  return buildNotePath(f, filename, configDir);
}

/**
 * Plan moves into the target layout. Sources may be flat, year/, or year/month/.
 * Never overwrites; skips conflicts. Files already at the target path are "already".
 */
export function planOrganize(
  moment: MomentFactory,
  files: string[],
  existing: Iterable<string>,
  folder: string,
  format: string,
  layout: DailyFolderLayout = "year",
  configDir = ".obsidian",
): IOrganizePlan {
  const plan: IOrganizePlan = { moves: [], skipped: [], byYear: {}, layout };
  if (layout === "flat") {
    return plan;
  }
  const existingList = [...existing];
  const taken = new Set(existingList.map((p) => p.toLowerCase()));
  const f = cleanFolder(folder);
  const cfg = cleanFolder(configDir);
  for (const path of [...files].sort()) {
    if (cfg && (path === cfg || path.startsWith(`${cfg}/`))) {
      continue;
    }
    const rel = relativeNotePath(path, f);
    if (rel === null) {
      continue;
    }
    if (format.includes("/")) {
      plan.skipped.push({ path, reason: "formatHasFolders" });
      continue;
    }
    const parts = rel.split("/");
    const okYear = parts.length === 2 && YEAR_DIR.test(parts[0]);
    const okYm = parts.length === 3 && YEAR_DIR.test(parts[0]) && MONTH_DIR.test(parts[1]);
    const okFlat = parts.length === 1;
    if (!okFlat && !okYear && !okYm) {
      if (parts.length > 1) {
        plan.skipped.push({ path, reason: "inSubfolder" });
      }
      continue;
    }
    const date = parseNoteDate(moment, rel, format, "day");
    if (!date) {
      plan.skipped.push({ path, reason: "unparsed" });
      continue;
    }
    const year = String(date.year()).padStart(4, "0");
    const month = periodMonth(date);
    const basename = parts[parts.length - 1];
    const to = organizedPath(f, basename, year, layout, month, configDir);
    if (!to) {
      plan.skipped.push({ path, reason: "conflict" });
      continue;
    }
    if (path.toLowerCase() === to.toLowerCase()) {
      plan.skipped.push({ path, reason: "already" });
      continue;
    }
    if (taken.has(to.toLowerCase())) {
      plan.skipped.push({ path, reason: "conflict" });
      continue;
    }
    taken.add(to.toLowerCase());
    const move: IMove = { from: path, to, year };
    if (layout === "year-month") {
      move.month = month;
    }
    plan.moves.push(move);
    plan.byYear[year] = (plan.byYear[year] || 0) + 1;
  }
  return plan;
}

/** Year of the period (for weeks: the year of the period start). */
export function periodYear(date: Moment, g: Granularity): string {
  return String(date.clone().startOf(g).year()).padStart(4, "0");
}

/**
 * Candidate paths of a note, best first for the active layout, then the others.
 * Lookup always covers flat, year, and year-month so mixed vaults keep working.
 */
export function notePathCandidates(
  folder: string,
  filename: string,
  year: string,
  layoutOrYearFolders: DailyFolderLayout | boolean,
  configDir?: string,
  month = "01",
): string[] {
  const layout: DailyFolderLayout =
    typeof layoutOrYearFolders === "boolean"
      ? layoutOrYearFolders
        ? "year"
        : "flat"
      : layoutOrYearFolders;
  const f = cleanFolder(folder);
  if (filename.includes("/")) {
    const only = buildNotePath(f, filename, configDir);
    return only ? [only] : [];
  }
  const flat = buildNotePath(f, filename, configDir);
  const yearPath = buildNotePath(f ? `${f}/${year}` : year, filename, configDir);
  const ymPath = buildNotePath(
    f ? `${f}/${year}/${month}` : `${year}/${month}`,
    filename,
    configDir,
  );
  const preferred =
    layout === "year-month" ? [ymPath, yearPath, flat] : layout === "year" ? [yearPath, flat, ymPath] : [flat, yearPath, ymPath];
  const out: string[] = [];
  for (const p of preferred) {
    if (p && !out.includes(p)) {
      out.push(p);
    }
  }
  return out;
}

export function preferNotePath(current: string, next: string, candidates: string[]): string {
  const rank = (p: string) => {
    const i = candidates.findIndex((c) => c.toLowerCase() === p.toLowerCase());
    return i < 0 ? candidates.length : i;
  };
  return rank(next) < rank(current) ? next : current;
}

/** Reverse of a journal: moves to undo, newest first. */
export function planUndo(
  moves: IMove[],
  exists: (path: string) => boolean,
): { undo: IMove[]; skipped: IMove[] } {
  const undo: IMove[] = [];
  const skipped: IMove[] = [];
  for (const m of [...moves].reverse()) {
    if (exists(m.to) && !exists(m.from)) {
      undo.push({ from: m.to, to: m.from, year: m.year, month: m.month });
    } else {
      skipped.push(m);
    }
  }
  return { undo, skipped };
}
