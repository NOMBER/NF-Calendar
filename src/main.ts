import type { Moment, WeekSpec } from "moment";
import { Menu, Notice, Plugin, TFile } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";

import { VIEW_TYPE_CALENDAR } from "./constants";
import { datesForMonthFrom, datesUntilEndOf, missingDates } from "./core/dates";
import type { Granularity } from "./core/dates";
import { dayKey } from "./core/important";
import type { IImportantDay } from "./core/important";
import { isEffectivelyEmpty, mergeTemplate } from "./core/merge";
import { getLanguage, setLanguage, t } from "./i18n";
import { readExternalPeriodicSettings } from "./io/external";
import {
  chooseTemplateFor,
  createNote,
  describeCandidate,
  findNote,
  getAllNotes,
  getDateFromFile,
  openOrCreateNote,
  renderTemplateFor,
  typeLabel,
} from "./io/notes";
import { CalendarSettingsTab } from "./settings";
import { migrateSettings, periodicConfig } from "./settingsData";
import type { ISettings } from "./settingsData";
import { ApplyTemplateModal } from "./ui/applyTemplateModal";
import { BatchCreateModal } from "./ui/batchModal";
import type { IBatchItem } from "./ui/batchModal";
import { ImportantListModal } from "./ui/importantListModal";
import { ImportantDayModal } from "./ui/importantModal";
import { StatsModal } from "./ui/statsModal";
import { activeFile, dailyNotes, monthlyNotes, settings, weeklyNotes } from "./ui/stores";
import CalendarView from "./view";

declare global {
  interface Window {
    app: App;
    moment: typeof import("moment");
    _bundledLocaleWeekSpec: WeekSpec;
  }
}

export default class CalendarPlugin extends Plugin {
  public options: ISettings;

  onunload(): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => leaf.detach());
  }

  async onload(): Promise<void> {
    this.register(
      settings.subscribe((value) => {
        this.options = value;
        setLanguage(value.language);
      })
    );

    const raw = await this.loadData();
    const isV1 = !!raw && typeof raw === "object" && typeof raw.settingsVersion !== "number";
    settings.set(migrateSettings(raw).settings);
    if (!isV1) {
      await this.saveData(this.options);
    }

    this.registerView(VIEW_TYPE_CALENDAR, (leaf: WorkspaceLeaf) => new CalendarView(leaf, this));
    this.registerCommands();
    this.addSettingTab(new CalendarSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      if (isV1) {
        // v1.0.0 read folder/format/template from Daily Notes / Periodic
        // Notes. Copy them once so nothing changes for the user.
        const migrated = migrateSettings(raw, readExternalPeriodicSettings(this.app));
        settings.set(migrated.settings);
        await this.saveData(this.options);
        new Notice(t("notice.migrated"), 8000);
      }
      this.reindexAll();
      this.initLeaf();
    });
  }

  private registerCommands(): void {
    const cmd = (id: string, name: string, callback: () => unknown, check?: () => boolean) =>
      this.addCommand(
        check
          ? {
              id,
              name,
              checkCallback: (checking: boolean) => {
                if (!check()) {
                  return false;
                }
                if (!checking) {
                  void callback();
                }
                return true;
              },
            }
          : { id, name, callback: () => void callback() }
      );

    cmd("show-calendar-view", t("cmd.openView"), () => this.initLeaf(), () =>
      this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0
    );
    cmd("open-yesterday-daily-note", t("cmd.openYesterday"), () => this.openDailyNoteForOffset(-1));
    cmd("open-today-daily-note", t("cmd.openToday"), () => this.openDailyNoteForOffset(0));
    cmd("open-tomorrow-daily-note", t("cmd.openTomorrow"), () => this.openDailyNoteForOffset(1));
    cmd("open-weekly-note", t("cmd.openWeekly"), () => this.openPeriodic(window.moment(), "week", false), () =>
      this.options.weekly.enabled
    );
    cmd("open-monthly-note", t("cmd.openMonthly"), () => this.openPeriodic(window.moment(), "month", false), () =>
      this.options.monthly.enabled
    );
    cmd("create-missing-daily-notes-week", t("cmd.missingWeek"), () => this.createMissingDailyNotes("week"));
    cmd("create-missing-daily-notes-month", t("cmd.missingMonth"), () => this.createMissingDailyNotes("month"));
    cmd("apply-template-to-active-note", t("cmd.applyTemplate"), () => this.applyTemplateToActiveNote(), () =>
      !!this.app.workspace.getActiveFile()
    );
    cmd("show-important-days", t("cmd.importantList"), () => this.showImportantDays());
    cmd("show-statistics", t("cmd.statistics"), () => this.showStatistics());
    cmd("reveal-active-note", t("cmd.reveal"), () => this.getView()?.revealActiveNote());
  }

  getView(): CalendarView | null {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    return (leaf?.view as CalendarView) ?? null;
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
      return;
    }
    this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_CALENDAR });
  }

  async writeOptions(changeOpts: (settings: ISettings) => Partial<ISettings>): Promise<void> {
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    await this.saveData(this.options);
  }

  reindexAll(): void {
    dailyNotes.reindex();
    weeklyNotes.reindex();
    monthlyNotes.reindex();
    this.getView()?.refresh();
  }

  openSettings(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setting = (this.app as any).setting;
    setting?.open?.();
    setting?.openTabById?.(this.manifest.id);
  }

  // ---------- notes ----------

  findDailyNote(date: Moment): TFile | null {
    return findNote(this.app, this.options, date, "day", get(dailyNotes));
  }

  async openPeriodic(date: Moment, g: Granularity, inNewSplit: boolean): Promise<void> {
    const store = g === "day" ? dailyNotes : g === "week" ? weeklyNotes : monthlyNotes;
    const existing = findNote(this.app, this.options, date, g, get(store));
    await openOrCreateNote(this.app, date, g, this.options, inNewSplit, existing, (file) => {
      activeFile.setFile(file);
      store.reindex();
    });
  }

  async openDailyNoteForOffset(daysFromToday: number): Promise<void> {
    const date = window.moment().startOf("day").add(daysFromToday, "day");
    await this.openPeriodic(date, "day", false);
  }

  /** "Create missing daily notes until end of week / month" (or for a displayed month). */
  async createMissingDailyNotes(scope: "week" | "month" | Moment): Promise<void> {
    if (!this.options.daily.enabled) {
      new Notice(t("notice.typeDisabled", { type: typeLabel("day") }));
      return;
    }
    const today = window.moment().startOf("day");
    const dates =
      scope === "week" || scope === "month"
        ? datesUntilEndOf(today, scope)
        : datesForMonthFrom(today, scope);
    if (!dates.length) {
      return;
    }
    const index = getAllNotes(this.app, this.options, "day");
    const missing = missingDates(dates, (d) => !!findNote(this.app, this.options, d, "day", index));
    if (!missing.length) {
      new Notice(
        t("notice.nothingMissing", {
          from: dates[0].format("LL"),
          to: dates[dates.length - 1].format("LL"),
        })
      );
      return;
    }
    const items: IBatchItem[] = missing.map((d) => {
      const res = chooseTemplateFor(this.app, d, this.options, "day");
      let label = res.chosen
        ? `${res.chosen.path} — ${describeCandidate(res.chosen)}`
        : t("batch.empty");
      if (res.missing.length) {
        label += ` (${t("source.missing", { paths: res.missing.map((m) => m.path).join(", ") })})`;
      }
      return { dateLabel: d.format("dd, D MMM YYYY"), path: d.format(this.options.daily.format), templateLabel: label };
    });
    new BatchCreateModal(this.app, items, async () => {
      let created = 0;
      let failed = 0;
      for (const d of missing) {
        const file = await createNote(this.app, d, this.options, "day", false);
        if (file) {
          created++;
        } else {
          failed++;
        }
      }
      dailyNotes.reindex();
      this.getView()?.refresh();
      new Notice(
        t("notice.batchDone", { created, total: missing.length }) +
          (failed ? `\n${t("notice.batchFailed", { failed })}` : "")
      );
    }).open();
  }

  // ---------- templates on existing notes ----------

  /** Granularity + date of a note of this plugin, if it is one. */
  noteDateOf(file: TFile): { date: Moment; g: Granularity } | null {
    for (const g of ["day", "week", "month"] as Granularity[]) {
      const date = getDateFromFile(file, this.options, g);
      if (date) {
        return { date, g };
      }
    }
    return null;
  }

  async applyTemplateToActiveNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    const info = file ? this.noteDateOf(file) : null;
    if (!file || !info) {
      new Notice(t("notice.noActiveDailyNote"));
      return;
    }
    await this.applyTemplateToNote(file, info.date, info.g);
  }

  async applyTemplateToNote(file: TFile, date: Moment, g: Granularity = "day"): Promise<void> {
    const { contents, resolution } = await renderTemplateFor(this.app, date, this.options, g, true);
    if (!resolution.chosen) {
      new Notice(t("notice.noTemplate", { date: date.format("LL") }));
      return;
    }
    const write = async (mode: "append" | "prepend" | "replace") => {
      // Re-read right before writing so nothing typed meanwhile is lost.
      await this.app.vault.process(file, (current) => mergeTemplate(current, contents, mode));
      new Notice(t("notice.templateApplied", { file: file.basename }));
      this.getView()?.refresh();
    };
    const existing = await this.app.vault.read(file);
    if (isEffectivelyEmpty(existing)) {
      await write("replace");
      return;
    }
    new ApplyTemplateModal(
      this.app,
      file.basename,
      t("apply.desc", { path: resolution.chosen.path, reason: describeCandidate(resolution.chosen) }),
      write
    ).open();
  }

  // ---------- important days ----------

  openImportantDayModal(date: Moment, after?: () => void): void {
    const key = dayKey(date);
    const existing = this.options.importantDays[key] ?? null;
    new ImportantDayModal(
      this.app,
      date.format("dddd, LL"),
      existing,
      async (day: IImportantDay) => {
        await this.writeOptions((old) => ({ importantDays: { ...old.importantDays, [key]: day } }));
        after?.();
      },
      existing
        ? async () => {
            await this.removeImportantDay(date);
            after?.();
          }
        : null
    ).open();
  }

  async removeImportantDay(date: Moment): Promise<void> {
    const key = dayKey(date);
    await this.writeOptions((old) => {
      const next = { ...old.importantDays };
      delete next[key];
      return { importantDays: next };
    });
  }

  showImportantDays(): void {
    new ImportantListModal(
      this.app,
      () => this.options.importantDays,
      (date) => void this.openPeriodic(window.moment(date, "YYYY-MM-DD"), "day", false),
      (date, refresh) => this.openImportantDayModal(window.moment(date, "YYYY-MM-DD"), refresh)
    ).open();
  }

  showStatistics(month?: Moment): void {
    dailyNotes.reindex();
    new StatsModal(
      this.app,
      {
        findDailyNote: (d) => this.findDailyNote(d),
        importantDays: () => this.options.importantDays,
        openDay: (d) => void this.openPeriodic(d, "day", false),
      },
      month
    ).open();
  }

  // ---------- menus ----------

  /** Menu with every action of the plugin (header button / right click on month title). */
  buildMainMenu(displayedMonth?: Moment): Menu {
    const menu = new Menu();
    const now = window.moment();
    const month = (displayedMonth || now).clone();
    const item = (title: string, icon: string, fn: () => unknown) =>
      menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => void fn()));

    item(t("cmd.openYesterday"), "arrow-left", () => this.openDailyNoteForOffset(-1));
    item(t("cmd.openToday"), "calendar-check", () => this.openDailyNoteForOffset(0));
    item(t("cmd.openTomorrow"), "arrow-right", () => this.openDailyNoteForOffset(1));
    if (this.options.weekly.enabled) {
      item(t("cmd.openWeekly"), "calendar-range", () => this.openPeriodic(now, "week", false));
    }
    if (this.options.monthly.enabled) {
      item(t("menu.openMonthly", { month: month.format("MMMM YYYY") }), "calendar", () =>
        this.openPeriodic(month, "month", false)
      );
    }
    menu.addSeparator();
    item(t("cmd.missingWeek"), "calendar-plus", () => this.createMissingDailyNotes("week"));
    item(t("cmd.missingMonth"), "calendar-plus", () => this.createMissingDailyNotes("month"));
    if (!month.isSame(now, "month") && month.isAfter(now, "month")) {
      item(t("menu.missingDisplayedMonth", { month: month.format("MMMM YYYY") }), "calendar-plus", () =>
        this.createMissingDailyNotes(month)
      );
    }
    const active = this.app.workspace.getActiveFile();
    if (active && this.noteDateOf(active)) {
      item(t("cmd.applyTemplate"), "file-input", () => this.applyTemplateToActiveNote());
    }
    menu.addSeparator();
    item(t("cmd.importantList"), "star", () => this.showImportantDays());
    item(t("cmd.statistics"), "bar-chart-2", () => this.showStatistics(month));
    item(t("cmd.settings"), "settings", () => this.openSettings());
    return menu;
  }

  showDayMenu(date: Moment, event: MouseEvent): void {
    const menu = new Menu();
    const note = this.findDailyNote(date);
    const important = this.options.importantDays[dayKey(date)];
    if (note) {
      menu.addItem((i) =>
        i.setTitle(t("menu.openNote")).setIcon("file-text").onClick(() => void this.openPeriodic(date, "day", false))
      );
      menu.addItem((i) =>
        i.setTitle(t("menu.openInSplit")).setIcon("separator-vertical").onClick(() => void this.openPeriodic(date, "day", true))
      );
      menu.addItem((i) =>
        i.setTitle(t("menu.applyTemplate")).setIcon("file-input").onClick(() => void this.applyTemplateToNote(note, date, "day"))
      );
    } else if (this.options.daily.enabled) {
      menu.addItem((i) =>
        i.setTitle(t("menu.createNote")).setIcon("file-plus").onClick(() => void this.openPeriodic(date, "day", false))
      );
    }
    menu.addSeparator();
    menu.addItem((i) =>
      i
        .setTitle(important ? t("menu.editImportant") : t("menu.markImportant"))
        .setIcon("star")
        .onClick(() => this.openImportantDayModal(date))
    );
    if (important) {
      menu.addItem((i) =>
        i.setTitle(t("menu.removeImportant")).setIcon("star-off").onClick(() => void this.removeImportantDay(date))
      );
    }
    if (note) {
      menu.addSeparator();
      menu.addItem((i) =>
        i
          .setTitle(t("menu.delete"))
          .setIcon("trash")
          .onClick(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.app as any).fileManager.promptForFileDeletion(note);
          })
      );
      this.app.workspace.trigger("file-menu", menu, note, "calendar-context-menu", null);
    }
    menu.showAtMouseEvent(event);
  }

  /** Current UI language (for tests / debugging). */
  get language(): string {
    return getLanguage();
  }

  periodicEnabled(g: Granularity): boolean {
    return periodicConfig(this.options, g).enabled;
  }
}
