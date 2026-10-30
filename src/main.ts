import type { Moment, WeekSpec } from "moment";
import { Plugin } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";

import { VIEW_TYPE_CALENDAR } from "./constants";
import { settings } from "./ui/stores";
import { findDailyNote, openOrCreateDailyNote } from "./io/dailyNotes";
import { activeFile } from "./ui/stores";
import {
  appHasPeriodicNotesPluginLoaded,
  CalendarSettingsTab,
} from "./settings";
import type { ISettings } from "./settings";
import CalendarView from "./view";

declare global {
  interface Window {
    app: App;
    moment: () => Moment;
    _bundledLocaleWeekSpec: WeekSpec;
  }
}

export default class CalendarPlugin extends Plugin {
  public options: ISettings;
  private view: CalendarView;

  onunload(): void {
    this.app.workspace
      .getLeavesOfType(VIEW_TYPE_CALENDAR)
      .forEach((leaf) => leaf.detach());
  }

  async onload(): Promise<void> {
    this.register(
      settings.subscribe((value) => {
        this.options = value;
      })
    );

    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf: WorkspaceLeaf) => (this.view = new CalendarView(leaf))
    );

    this.addCommand({
      id: "show-calendar-view",
      name: "Open view",
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0
          );
        }
        this.initLeaf();
      },
    });

    this.addCommand({
      id: "open-weekly-note",
      name: "Open Weekly Note",
      checkCallback: (checking) => {
        if (checking) {
          return !appHasPeriodicNotesPluginLoaded();
        }
        this.view?.openOrCreateWeeklyNote(window.moment(), false);
      },
    });

    this.addCommand({
      id: "open-today-daily-note",
      name: "Open today's daily note (weekday template)",
      callback: () => this.openDailyNoteForOffset(0),
    });

    this.addCommand({
      id: "open-tomorrow-daily-note",
      name: "Open tomorrow's daily note (weekday template)",
      callback: () => this.openDailyNoteForOffset(1),
    });

    this.addCommand({
      id: "reveal-active-note",
      name: "Reveal active note",
      callback: () => this.view?.revealActiveNote(),
    });

    await this.loadOptions();

    this.addSettingTab(new CalendarSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => this.initLeaf());
  }

  async openDailyNoteForOffset(daysFromToday: number): Promise<void> {
    const date = window.moment().startOf("day").add(daysFromToday, "day");
    await openOrCreateDailyNote(
      date,
      false,
      this.options,
      findDailyNote(date),
      (file) => activeFile.setFile(file)
    );
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false).setViewState({
      type: VIEW_TYPE_CALENDAR,
    });
  }

  async loadOptions(): Promise<void> {
    const options = await this.loadData();
    settings.update((old) => {
      return {
        ...old,
        ...(options || {}),
      };
    });

    await this.saveData(this.options);
  }

  async writeOptions(
    changeOpts: (settings: ISettings) => Partial<ISettings>
  ): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }
}
