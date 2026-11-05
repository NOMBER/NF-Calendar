/**
 * "Organize daily notes by year" and year-subfolder path resolution (pure).
 * Folder/2026-10-30.md  ->  Folder/2026/2026-10-30.md
 */
import type { Moment } from "moment";

import type { Granularity, MomentFactory } from "./dates";
import { parseNoteDate } from "./dates";
import { buildNotePath, cleanFolder, relativeNotePath } from "./paths";

export type SkipReason = "unparsed" | "conflict" | "inSubfolder" | "formatHasFolders";

export interface IMove {
  from: string;
  to: string;
  year: string;
}

export interface ISkip {
  path: string;
  reason: SkipReason;
}

export interface IOrganizePlan {
  moves: IMove[];
  skipped: ISkip[];
  /** year -> number of moves */
  byYear: Record<string, number>;
}

const YEAR_DIR = /^\d{4}$/;

/** Is this path inside `folder/<YYYY>/` directly? */
export function isInYearFolder(path: string, folder: string): boolean {
  const rel = relativeNotePath(path, folder);
  if (rel === null) {
    return false;
  }
  const parts = rel.split("/");
  return parts.length === 2 && YEAR_DIR.test(parts[0]);
}

/**
 * Plan the move. `files` are vault paths (any type: non-md and files outside
 * the folder are ignored). `existing` is the set of all vault paths, used to
 * detect name conflicts (case-insensitive, like most file systems).
 */
export function planOrganize(
  moment: MomentFactory,
  files: string[],
  existing: Iterable<string>,
  folder: string,
  format: string,
  configDir = ".obsidian",
): IOrganizePlan {
  const plan: IOrganizePlan = { moves: [], skipped: [], byYear: {} };
  const taken = new Set<string>();
  for (const p of existing) {
    taken.add(p.toLowerCase());
  }
  const f = cleanFolder(folder);
  const cfg = cleanFolder(configDir);
  const sorted = [...files].sort();
  for (const path of sorted) {
    if (cfg && (path === cfg || path.startsWith(`${cfg}/`))) {
      continue;
    }
    const rel = relativeNotePath(path, f);
    if (rel === null) {
      continue; // not .md or not in the folder
    }
    if (rel.includes("/")) {
      if (parseNoteDate(moment, rel, format, "day")) {
        plan.skipped.push({ path, reason: "inSubfolder" });
      }
      continue;
    }
    if (format.includes("/")) {
      plan.skipped.push({ path, reason: "formatHasFolders" });
      continue;
    }
    const date = parseNoteDate(moment, rel, format, "day");
    if (!date) {
      plan.skipped.push({ path, reason: "unparsed" });
      continue;
    }
    const year = String(date.year()).padStart(4, "0");
    const to = buildNotePath(f ? `${f}/${year}` : year, rel, configDir);
    if (!to || taken.has(to.toLowerCase())) {
      plan.skipped.push({ path, reason: "conflict" });
      continue;
    }
    taken.add(to.toLowerCase());
    plan.moves.push({ from: path, to, year });
    plan.byYear[year] = (plan.byYear[year] || 0) + 1;
  }
  return plan;
}

/** Year of the period (for weeks: the year of the period start). */
export function periodYear(date: Moment, g: Granularity): string {
  return String(date.clone().startOf(g).year()).padStart(4, "0");
}

/**
 * Candidate paths of a note, best first:
 * expected (with year folder if enabled), then the other layout.
 * Any other year folder is covered by the date index.
 */
export function notePathCandidates(
  folder: string,
  filename: string,
  year: string,
  yearFolders: boolean,
  configDir?: string,
): string[] {
  const f = cleanFolder(folder);
  const flat = buildNotePath(f, filename, configDir);
  const nested = filename.includes("/")
    ? null
    : buildNotePath(f ? `${f}/${year}` : year, filename, configDir);
  const order = yearFolders ? [nested, flat] : [flat, nested];
  return order.filter((p, i): p is string => !!p && order.indexOf(p) === i);
}

/**
 * Two files for the same date (e.g. a flat one created by another plugin next
 * to the organized one in a year folder): which one the calendar shows.
 * Lower rank wins: position in `candidates` (expected path first), any other
 * location after them. Ties keep the current one, so the result is stable.
 */
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
      undo.push({ from: m.to, to: m.from, year: m.year });
    } else {
      skipped.push(m);
    }
  }
  return { undo, skipped };
}
