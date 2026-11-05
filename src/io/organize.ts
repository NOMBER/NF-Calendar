/** Execute "organize daily notes by year" moves (and undo) in the vault. */
import { normalizePath, TFile, TFolder } from "obsidian";
import type { App } from "obsidian";

import type { IMove, IOrganizePlan } from "src/core/organize";
import { planOrganize } from "src/core/organize";
import { isSafeVaultPath } from "src/core/paths";
import { periodicConfig } from "src/core/settings";
import type { ISettings } from "src/core/settings";
import { noteFormat } from "./notes";

/** Files per batch before yielding to the UI. */
const BATCH = 25;

export function buildOrganizePlan(app: App, settings: ISettings): IOrganizePlan {
  const cfg = periodicConfig(settings, "day");
  const all = app.vault.getFiles().map((f) => f.path);
  const folders = app.vault
    .getAllLoadedFiles()
    .filter((f) => f instanceof TFolder)
    .map((f) => f.path);
  return planOrganize(
    window.moment,
    all,
    [...all, ...folders],
    cfg.folder,
    noteFormat(settings, "day"),
    app.vault.configDir,
  );
}

export interface IRunResult {
  done: IMove[];
  failed: { move: IMove; error: string }[];
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const dir = path.split("/").slice(0, -1).join("/");
  if (!dir || app.vault.getAbstractFileByPath(dir)) {
    return;
  }
  await app.vault.createFolder(dir);
}

/**
 * Move files one by one with fileManager.renameFile (Obsidian updates links).
 * Each move is re-checked right before it runs: source must still be a .md
 * file, target must not exist (never overwrite), both paths in the vault.
 */
export async function runMoves(
  app: App,
  moves: IMove[],
  onProgress: (done: number, total: number) => void,
): Promise<IRunResult> {
  const result: IRunResult = { done: [], failed: [] };
  const configDir = app.vault.configDir;
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const from = normalizePath(move.from);
    const to = normalizePath(move.to);
    try {
      const src = app.vault.getAbstractFileByPath(from);
      if (!(src instanceof TFile) || src.extension !== "md") {
        throw new Error("source missing");
      }
      if (!isSafeVaultPath(from, configDir) || !isSafeVaultPath(to, configDir)) {
        throw new Error("unsafe path");
      }
      if (app.vault.getAbstractFileByPath(to)) {
        throw new Error("target exists");
      }
      await ensureFolder(app, to);
      await app.fileManager.renameFile(src, to);
      result.done.push({ from, to, year: move.year });
    } catch (e) {
      result.failed.push({ move, error: e instanceof Error ? e.message : String(e) });
    }
    if ((i + 1) % BATCH === 0 || i === moves.length - 1) {
      onProgress(i + 1, moves.length);
      await new Promise((r) => window.setTimeout(r, 0));
    }
  }
  return result;
}
