/**
 * The ONLY place that reads settings of other plugins. Used by the explicit
 * "Import" button and, once, when migrating settings saved by v1.0.0 (which
 * took its daily note configuration from those plugins).
 * Nothing is enabled or written in other plugins.
 */
import type { App } from "obsidian";

import type { IExternalPeriodicSettings, IPeriodicConfig } from "src/core/settings";
import { isRecord } from "src/core/unknown";

function pick(raw: unknown): Partial<IPeriodicConfig> | null {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    folder: typeof raw.folder === "string" ? raw.folder : "",
    format: typeof raw.format === "string" ? raw.format : "",
    template: typeof raw.template === "string" ? raw.template : "",
  };
}

function periodicSettings(plugin: unknown): unknown {
  return plugin && typeof plugin === "object" && "settings" in plugin
    ? (plugin as { settings?: unknown }).settings
    : undefined;
}

export function readExternalPeriodicSettings(app: App): IExternalPeriodicSettings {
  const result: IExternalPeriodicSettings = {};
  try {
    const periodic = app.plugins?.getPlugin?.("periodic-notes");
    const ps = periodicSettings(periodic);
    if (isRecord(ps)) {
      if (isRecord(ps.daily) && ps.daily.enabled) {
        result.daily = pick(ps.daily);
      }
      if (isRecord(ps.weekly) && ps.weekly.enabled) {
        result.weekly = pick(ps.weekly);
      }
      if (isRecord(ps.monthly) && ps.monthly.enabled) {
        result.monthly = pick(ps.monthly);
      }
    }
    // Core Daily Notes plugin (only if Periodic Notes doesn't handle daily)
    if (!result.daily) {
      const core = app.internalPlugins?.getPluginById?.("daily-notes");
      const opts = core?.instance?.options;
      if (opts) {
        result.daily = pick(opts);
      }
    }
  } catch (err) {
    console.warn("[NF-Calendar] could not read Daily Notes / Periodic Notes settings", err);
  }
  return result;
}

/**
 * Other plugins that create daily notes by themselves (they do not know about
 * year folders and create `<folder>/<date>.md`). Names for a warning only.
 */
export function otherDailyNoteCreators(app: App): string[] {
  const out: string[] = [];
  try {
    const core = app.internalPlugins?.getPluginById?.("daily-notes");
    if (core?.enabled) {
      const opts = core.instance?.options;
      const autorun = isRecord(opts) && opts.autorun === true;
      out.push(autorun ? "Daily notes (core, open on startup)" : "Daily notes (core)");
    }
    const psPlugin = app.plugins?.getPlugin?.("periodic-notes");
    const ps = periodicSettings(psPlugin);
    if (psPlugin && !(isRecord(ps) && isRecord(ps.daily) && ps.daily.enabled === false)) {
      out.push("Periodic Notes");
    }
  } catch {
    // diagnostics only
  }
  return out;
}
