/**
 * The ONLY place that reads settings of other plugins. Used by the explicit
 * "Import" button and, once, when migrating settings saved by v1.0.0 (which
 * took its daily note configuration from those plugins).
 * Nothing is enabled or written in other plugins.
 */
import type { App } from "obsidian";

import type { IExternalPeriodicSettings, IPeriodicConfig } from "src/core/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pick(raw: any): Partial<IPeriodicConfig> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return {
    folder: typeof raw.folder === "string" ? raw.folder : "",
    format: typeof raw.format === "string" ? raw.format : "",
    template: typeof raw.template === "string" ? raw.template : "",
  };
}

export function readExternalPeriodicSettings(app: App): IExternalPeriodicSettings {
  const result: IExternalPeriodicSettings = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyApp = app as any;
    // Periodic Notes (community, 0.x settings shape: {daily, weekly, monthly})
    const periodic = anyApp.plugins?.getPlugin?.("periodic-notes");
    const ps = periodic?.settings;
    if (ps?.daily?.enabled) {
      result.daily = pick(ps.daily);
    }
    if (ps?.weekly?.enabled) {
      result.weekly = pick(ps.weekly);
    }
    if (ps?.monthly?.enabled) {
      result.monthly = pick(ps.monthly);
    }
    // Core Daily Notes plugin (only if Periodic Notes doesn't handle daily)
    if (!result.daily) {
      const core = anyApp.internalPlugins?.getPluginById?.("daily-notes");
      const opts = core?.instance?.options;
      if (opts) {
        result.daily = pick(opts);
      }
    }
  } catch (err) {
    console.warn("[Calendar] could not read Daily Notes / Periodic Notes settings", err);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyApp = app as any;
    const core = anyApp.internalPlugins?.getPluginById?.("daily-notes");
    if (core?.enabled) {
      out.push(
        core.instance?.options?.autorun
          ? "Daily notes (core, open on startup)"
          : "Daily notes (core)",
      );
    }
    const ps = anyApp.plugins?.getPlugin?.("periodic-notes");
    if (ps && ps.settings?.daily?.enabled !== false) {
      out.push("Periodic Notes");
    }
  } catch {
    // diagnostics only
  }
  return out;
}
