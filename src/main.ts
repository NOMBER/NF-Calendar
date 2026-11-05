import type { Moment, WeekSpec } from "moment";
import { Notice, Plugin, TFile } from "obsidian";
import type { App, Modal, TAbstractFile, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";

import { VIEW_TYPE_CALENDAR } from "./constants";
import { adjacentDate, datesForMonthFrom, datesUntilEndOf, missingDates } from "src/core/dates";
import type { Granularity } from "src/core/dates";
import { setLanguage, t } from "src/core/i18n";
import { customColorCss, dayKey } from "src/core/important";
import { planUndo } from "src/core/organize";
import { buildOrganizePlan, runMoves } from "src/io/organize";
import { OrganizeModal } from "src/ui/modals/organize";
import type { IImportantDay } from "src/core/important";
import { isEffectivelyEmpty, mergeTemplate } from "src/core/merge";
import type { MergeMode } from "src/core/merge";
import { migrateSettings, periodicConfig, shouldOpenOnStartup } from "src/core/settings";
import type { ISettings } from "src/core/settings";
import { otherDailyNoteCreators, readExternalPeriodicSettings } from "src/io/external";
import { holidaysFor, rebuildHolidays, touchesHolidays } from "src/io/holidays";
import {
  chooseTemplateFor,
  createNote,
  findNote,
  getAllNotes,
  getDateFromFile,
  notePaths,
  getNotePath,
  openFile,
  renderTemplateFor,
} from "src/io/notes";
import { describeCandidate, typeLabel } from "src/ui/labels";
import { ApplyTemplateModal } from "src/ui/modals/applyTemplate";
import { BatchCreateModal } from "src/ui/modals/batchCreate";
import type { IBatchItem } from "src/ui/modals/batchCreate";
import { ConfirmationModal } from "src/ui/modals/confirm";
import { DateNavigatorModal } from "src/ui/modals/dateNavigator";
import { isBlankDailyNote, pickRandomDay, pickRandomNonEmptyDay } from "src/core/random";
import type { RandomScope } from "src/core/random";
import { ImportantDayModal } from "src/ui/modals/importantDay";
import { ImportantListModal } from "src/ui/modals/importantList";
import { StatsModal } from "src/ui/modals/stats";
import { CalendarSettingsTab } from "src/ui/settingsTab";
import { activeFile, dailyNotes, monthlyNotes, settings, weeklyNotes } from "src/ui/stores";
import CalendarView from "src/ui/view";

declare global {
  interface Window {
    app: App;
    moment: typeof import("moment");
    _bundledLocaleWeekSpec: WeekSpec;
  }
}

/** Plugin entry: lifecycle, commands and the actions behind menus. */
export default class CalendarPlugin extends Plugin {
  public options: ISettings;
  /** Modals opened by the plugin, closed on unload so no callback outlives it. */
  private openModals = new Set<Modal>();
  private batchRunning = false;

  /** <style> with rules for custom important-day colours (validated hex only). */
  private colorStyleEl: HTMLStyleElement | null = null;

  private applyCustomColors(value: ISettings): void {
    if (typeof document === "undefined" || !document.head) {
      return;
    }
    const css = customColorCss(value.importantDays);
    if (!this.colorStyleEl) {
      this.colorStyleEl = document.createElement("style");
      this.colorStyleEl.setAttribute("data-cwt", "custom-colors");
      document.head.appendChild(this.colorStyleEl);
    }
    this.colorStyleEl.textContent = css;
  }

  onunload(): void {
    this.colorStyleEl?.remove();
    this.colorStyleEl = null;
    this.openModals.forEach((m) => m.close());
    this.openModals.clear();
    this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => leaf.detach());
  }

  /** Open a modal and remember it until it closes. */
  private show(modal: Modal): void {
    const onClose = modal.onClose?.bind(modal);
    modal.onClose = () => {
      this.openModals.delete(modal);
      onClose?.();
    };
    this.openModals.add(modal);
    modal.open();
  }

  async onload(): Promise<void> {
    this.register(
      settings.subscribe((value) => {
        this.options = value;
        setLanguage(value.language);
        this.applyCustomColors(value);
      }),
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

    // Captured before onLayoutReady: false only during the app start.
    const layoutReadyAtLoad = this.app.workspace.layoutReady;
    this.app.workspace.onLayoutReady(async () => {
      if (isV1) {
        // v1.0.0 read folder/format/template from Daily Notes / Periodic
        // Notes. Copy them once so nothing changes for the user.
        const migrated = migrateSettings(raw, readExternalPeriodicSettings(this.app));
        settings.set(migrated.settings);
        await this.saveData(this.options);
        new Notice(t("notice.migrated"), 8000);
      }
      this.rebuildHolidays();
      const onHolidayEvent = (file: TAbstractFile, oldPath?: string) => {
        if (touchesHolidays(file, oldPath)) {
          this.rebuildHolidays();
        }
      };
      this.registerEvent(this.app.vault.on("create", (f) => onHolidayEvent(f)));
      this.registerEvent(this.app.vault.on("delete", (f) => onHolidayEvent(f)));
      this.registerEvent(this.app.vault.on("rename", (f, old) => onHolidayEvent(f, old)));
      this.registerEvent(this.app.vault.on("create", (f) => this.checkDuplicateDaily(f)));
      for (const f of this.app.vault.getMarkdownFiles()) {
        this.checkDuplicateDaily(f); // a note created by another plugin before we were ready
      }
      this.reindexAll();
      this.initLeaf();
      if (
        shouldOpenOnStartup(
          this.options.openDailyOnStartup,
          layoutReadyAtLoad,
          this.options.daily.enabled !== false,
        )
      ) {
        await this.openTodayOnStartup();
      }
    });
  }

  /** Startup: focus today's note if a tab already shows it, else open / create it (no confirmation). */
  private async openTodayOnStartup(): Promise<void> {
    try {
      const today = window.moment();
      let file = findNote(this.app, this.options, today, "day");
      if (!file) {
        file = await createNote(this.app, today, this.options, "day");
      }
      if (!file) {
        return;
      }
      const path = file.path;
      const leaf = this.app.workspace
        .getLeavesOfType("markdown")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((l) => (l.view as any)?.file?.path === path);
      if (leaf) {
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
      } else {
        await openFile(this.app, file, false);
      }
      activeFile.setFile(file);
      dailyNotes.reindex();
    } catch (err) {
      console.error("[NF-Calendar] open daily note on startup failed", err);
    }
  }

  private warnedDuplicates = new Set<string>();

  /**
   * Year folders on, and a daily note appears directly in the daily folder
   * while the same date already exists in a year folder: something else
   * (usually the core Daily notes plugin or Periodic Notes) created it.
   * We never delete it; we tell the user which file to check.
   */
  private checkDuplicateDaily(f: TAbstractFile): void {
    if (!(f instanceof TFile) || f.extension !== "md" || !this.options.daily.yearFolders) {
      return;
    }
    const date = getDateFromFile(f, this.options, "day");
    if (!date) {
      return;
    }
    const [expected] = notePaths(date, this.options, "day", this.app.vault.configDir);
    if (!expected || expected === f.path || this.warnedDuplicates.has(f.path)) {
      return;
    }
    if (this.app.vault.getAbstractFileByPath(expected) instanceof TFile) {
      this.warnedDuplicates.add(f.path);
      const who = otherDailyNoteCreators(this.app);
      new Notice(
        t("notice.duplicateDaily", {
          dup: f.path,
          main: expected,
          who: who.length ? who.join(", ") : "?",
        }),
        0,
      );
    }
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
          : { id, name, callback: () => void callback() },
      );

    cmd(
      "show-calendar-view",
      t("cmd.openView"),
      () => this.initLeaf(),
      () => this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0,
    );
    cmd("open-yesterday-daily-note", t("cmd.openYesterday"), () => this.openDailyNoteForOffset(-1));
    cmd("open-today-daily-note", t("cmd.openToday"), () => this.openDailyNoteForOffset(0));
    cmd("open-tomorrow-daily-note", t("cmd.openTomorrow"), () => this.openDailyNoteForOffset(1));
    cmd("organize-daily-notes-by-year", t("cmd.organize"), () => this.organizeDailyNotes());
    cmd(
      "undo-last-organize",
      t("cmd.undoOrganize"),
      () => this.undoLastOrganize(),
      () => !!this.options.lastOrganize,
    );
    cmd("open-previous-daily-note", t("cmd.prevDaily"), () => this.openAdjacentDailyNote(-1));
    cmd("open-next-daily-note", t("cmd.nextDaily"), () => this.openAdjacentDailyNote(1));
    cmd(
      "open-weekly-note",
      t("cmd.openWeekly"),
      () => this.openPeriodic(window.moment(), "week", false),
      () => this.options.weekly.enabled,
    );
    cmd(
      "open-monthly-note",
      t("cmd.openMonthly"),
      () => this.openPeriodic(window.moment(), "month", false),
      () => this.options.monthly.enabled,
    );
    cmd("create-missing-daily-notes-week", t("cmd.missingWeek"), () =>
      this.createMissingDailyNotes("week"),
    );
    cmd("create-missing-daily-notes-month", t("cmd.missingMonth"), () =>
      this.createMissingDailyNotes("month"),
    );
    cmd(
      "apply-template-to-active-note",
      t("cmd.applyTemplate"),
      () => this.applyTemplateToActiveNote(),
      () => !!this.app.workspace.getActiveFile(),
    );
    cmd("show-important-days", t("cmd.importantList"), () => this.showImportantDays());
    cmd("open-random-daily-note", t("cmd.randomDaily"), () => this.openRandomDailyNote());
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
    const before = this.options;
    settings.update((old) => ({ ...old, ...changeOpts(old) }));
    const after = this.options;
    if (
      before.holidaysFolder !== after.holidaysFolder ||
      before.holidayDateOrder !== after.holidayDateOrder ||
      before.holidayPattern !== after.holidayPattern
    ) {
      this.rebuildHolidays();
    }
    if (
      before.showHolidayMarks !== after.showHolidayMarks ||
      before.showImportantMarks !== after.showImportantMarks
    ) {
      this.getView()?.refresh();
    }
    await this.saveData(this.options);
  }

  /** Re-read the holidays folder (only on settings change or folder events). */
  rebuildHolidays(): void {
    try {
      rebuildHolidays(this.app, this.options);
    } catch (err) {
      console.warn("[Calendar] holidays index failed", err);
    }
  }

  private organizing = false;

  /** Preview + confirm, then move flat daily notes into `<folder>/<YYYY>/`. */
  organizeDailyNotes(): void {
    if (this.organizing) {
      new Notice(t("organize.busy"));
      return;
    }
    const plan = buildOrganizePlan(this.app, this.options);
    const folder = this.options.daily.folder || "/";
    this.show(
      new OrganizeModal(
        this.app,
        plan,
        folder,
        async (onProgress) => {
          this.organizing = true;
          try {
            const result = await runMoves(this.app, plan.moves, onProgress);
            if (result.done.length) {
              await this.writeOptions(() => ({
                lastOrganize: { at: new Date().toISOString(), moves: result.done },
              }));
            }
            return result;
          } finally {
            this.organizing = false;
            this.reindexAll();
          }
        },
        !!this.options.daily.yearFolders,
        async () => {
          await this.writeOptions((old) => ({ daily: { ...old.daily, yearFolders: true } }));
          this.reindexAll();
          new Notice(t("organize.enabled"));
        },
      ),
    );
  }

  /** Move the files of the last organize run back (only where safe). */
  async undoLastOrganize(): Promise<void> {
    const journal = this.options.lastOrganize;
    if (!journal || this.organizing) {
      new Notice(t(journal ? "organize.busy" : "organize.nothingToUndo"));
      return;
    }
    const { undo, skipped } = planUndo(
      journal.moves,
      (p) => !!this.app.vault.getAbstractFileByPath(p),
    );
    this.show(
      new ConfirmationModal(this.app, {
        cta: t("organize.undo"),
        title: t("organize.undo"),
        text: t("organize.undoConfirm", { count: undo.length, skipped: skipped.length }),
        onAccept: async () => {
          this.organizing = true;
          const notice = new Notice(t("organize.progress", { done: 0, total: undo.length }), 0);
          try {
            const result = await runMoves(this.app, undo, (done, total) =>
              notice.setMessage(t("organize.progress", { done, total })),
            );
            await this.writeOptions(() => ({ lastOrganize: null }));
            new Notice(
              t("organize.undone", { moved: result.done.length, failed: result.failed.length }),
            );
          } finally {
            notice.hide();
            this.organizing = false;
            this.reindexAll();
          }
        },
      }),
    );
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

  /** Open the note of a date; create it (after confirmation, if enabled) when missing. */
  async openPeriodic(date: Moment, g: Granularity, inNewSplit: boolean): Promise<void> {
    const store = g === "day" ? dailyNotes : g === "week" ? weeklyNotes : monthlyNotes;
    const done = (file: TFile) => {
      activeFile.setFile(file);
      store.reindex();
    };
    const existing = findNote(this.app, this.options, date, g, get(store));
    if (existing) {
      await openFile(this.app, existing, inNewSplit);
      done(existing);
      return;
    }
    if (!periodicConfig(this.options, g).enabled) {
      new Notice(t("notice.typeDisabled", { type: typeLabel(g) }));
      return;
    }
    const create = async () => {
      const created = await createNote(this.app, date, this.options, g);
      if (created) {
        await openFile(this.app, created, inNewSplit);
        done(created);
      }
    };
    const path = getNotePath(date, this.options, g, this.app.vault.configDir);
    if (this.options.shouldConfirmBeforeCreate && path) {
      this.show(
        new ConfirmationModal(this.app, {
          cta: t("confirm.create"),
          onAccept: create,
          text: t("confirm.text", { file: path }),
          title: t("confirm.title"),
        }),
      );
    } else {
      await create(); // an unsafe path is reported by createNote
    }
  }

  /** Previous / next EXISTING daily note relative to the active one (never creates). */
  async openAdjacentDailyNote(direction: -1 | 1): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    const current = file ? getDateFromFile(file, this.options, "day") : null;
    if (!current) {
      new Notice(t("notice.notADailyNote"));
      return;
    }
    const index = getAllNotes(this.app, this.options, "day");
    const dates = Object.values(index)
      .map((f) => getDateFromFile(f, this.options, "day"))
      .filter((d): d is Moment => !!d);
    const target = adjacentDate(dates, current, direction);
    const note = target ? findNote(this.app, this.options, target, "day", index) : null;
    if (!note) {
      new Notice(t("notice.noAdjacentNote"));
      return;
    }
    await openFile(this.app, note, false);
    activeFile.setFile(note);
  }

  private lastRandomDay: string | null = null;

  /**
   * Opens a random existing daily note in the scope. Uses the note index
   * (flat + year folders, one file per day); file contents are read only
   * with `skipEmpty`, and then only for the drawn candidates.
   */
  async openRandomDailyNote(
    scope: RandomScope = { kind: "all" },
    skipEmpty = false,
  ): Promise<boolean> {
    const byDay = new Map<string, TFile>();
    for (const f of Object.values(getAllNotes(this.app, this.options, "day"))) {
      const d = getDateFromFile(f, this.options, "day");
      if (d) byDay.set(d.format("YYYY-MM-DD"), f);
    }
    const opts = { exclude: this.lastRandomDay };
    const day = skipEmpty
      ? await pickRandomNonEmptyDay(
          byDay.keys(),
          scope,
          async (k) => isBlankDailyNote(await this.app.vault.cachedRead(byDay.get(k) as TFile)),
          opts,
        )
      : pickRandomDay(byDay.keys(), scope, opts);
    const file = day ? byDay.get(day) : null;
    if (!day || !file) {
      new Notice(t(skipEmpty ? "notice.randomNoneNonEmpty" : "notice.randomNone"));
      return false;
    }
    this.lastRandomDay = day;
    await openFile(this.app, file, false);
    activeFile.setFile(file);
    return true;
  }

  async openDailyNoteForOffset(daysFromToday: number): Promise<void> {
    const date = window.moment().startOf("day").add(daysFromToday, "day");
    await this.openPeriodic(date, "day", false);
  }

  /** "Create missing daily notes until end of week / month" (or for a displayed month). */
  async createMissingDailyNotes(scope: "week" | "month" | Moment): Promise<void> {
    if (this.batchRunning) {
      return;
    }
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
        }),
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
      return {
        dateLabel: d.format("dd, D MMM YYYY"),
        path: d.format(this.options.daily.format),
        templateLabel: label,
      };
    });
    const existingCount = dates.length - missing.length;
    this.show(new BatchCreateModal(this.app, items, existingCount, () => this.runBatch(missing)));
  }

  /** Sequential on purpose: predictable order and no parallel writes. */
  private async runBatch(dates: Moment[]): Promise<void> {
    if (this.batchRunning) {
      return;
    }
    this.batchRunning = true;
    const progress = dates.length > 5 ? new Notice(t("batch.running"), 0) : null;
    let created = 0;
    let failed = 0;
    try {
      for (const d of dates) {
        // A note created meanwhile (sync, a click) is skipped, never overwritten.
        if (this.findDailyNote(d)) {
          continue;
        }
        const file = await createNote(this.app, d, this.options, "day", {
          notifyMissing: false,
          carryover: false,
        });
        if (file) {
          created++;
        } else {
          failed++;
        }
      }
    } finally {
      this.batchRunning = false;
      progress?.hide();
    }
    dailyNotes.reindex();
    this.getView()?.refresh();
    new Notice(
      t("notice.batchDone", { created, total: dates.length }) +
        (failed ? `\n${t("notice.batchFailed", { failed })}` : ""),
    );
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
    const { contents, resolution } = await renderTemplateFor(this.app, date, this.options, g);
    if (!resolution.chosen) {
      new Notice(t("notice.noTemplate", { date: date.format("LL") }));
      return;
    }
    const write = async (mode: MergeMode) => {
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
    this.show(
      new ApplyTemplateModal(
        this.app,
        file.basename,
        t("apply.desc", {
          path: resolution.chosen.path,
          reason: describeCandidate(resolution.chosen),
        }),
        write,
        () => new Notice(t("notice.templateSkipped", { file: file.basename })),
      ),
    );
  }

  // ---------- important days ----------

  openImportantDayModal(date: Moment, after?: () => void): void {
    const key = dayKey(date);
    const existing = this.options.importantDays[key] ?? null;
    this.show(
      new ImportantDayModal(
        this.app,
        date.format("dddd, LL"),
        existing,
        async (day: IImportantDay) => {
          await this.writeOptions((old) => ({
            importantDays: { ...old.importantDays, [key]: day },
          }));
          after?.();
        },
        existing
          ? async () => {
              await this.removeImportantDay(date);
              after?.();
            }
          : null,
      ),
    );
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
    this.show(
      new ImportantListModal(
        this.app,
        () => this.options.importantDays,
        (date) => void this.openPeriodic(window.moment(date, "YYYY-MM-DD"), "day", false),
        (date, refresh) => this.openImportantDayModal(window.moment(date, "YYYY-MM-DD"), refresh),
      ),
    );
  }

  showStatistics(month?: Moment): void {
    dailyNotes.reindex();
    this.show(
      new StatsModal(
        this.app,
        {
          findDailyNote: (d) => this.findDailyNote(d),
          importantDays: () => this.options.importantDays,
          openDay: (d) => void this.openPeriodic(d, "day", false),
          holidays: (d) => holidaysFor(d),
          view: () => this.options.statsView,
          saveView: (v) => void this.writeOptions(() => ({ statsView: v })),
        },
        month,
      ),
    );
  }

  /** Quick jump: year / month grid and a "go to date" field. */
  showDateNavigator(month: Moment, goToMonth: (m: Moment) => void): void {
    this.show(
      new DateNavigatorModal(this.app, {
        month,
        goToMonth,
        showStats: (m) => this.showStatistics(m),
        openDay: (d) => void this.openPeriodic(d, "day", false),
        hasNote: (d) => !!this.findDailyNote(d),
        openRandom: (scope, skipEmpty) => this.openRandomDailyNote(scope, skipEmpty),
      }),
    );
  }

  /** Open a holiday note by its vault path. */
  async openHoliday(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    }
  }
}
