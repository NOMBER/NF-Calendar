import type { Plugin, TFile } from "obsidian";

/**
 * Minimal typings for undocumented Obsidian internals used by this plugin.
 * Keep these narrow: only the methods and fields we actually call.
 */
declare module "obsidian" {
  interface App {
    setting?: {
      open: () => void;
      openTabById: (id: string) => void;
    };
    foldManager?: {
      load: (file: TFile) => unknown;
      save: (file: TFile, info: unknown) => void;
    };
    plugins?: {
      getPlugin: (id: string) => Plugin | undefined;
    };
    internalPlugins?: {
      getPluginById: (id: string) => InternalPlugin | undefined;
    };
  }

  interface Vault {
    getConfig?: (key: string) => unknown;
  }

  interface FileManager {
    promptForFileDeletion: (file: TFile) => void;
  }
}

interface InternalPlugin {
  enabled?: boolean;
  instance?: {
    options?: unknown;
  };
}

export {};
