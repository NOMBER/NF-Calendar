import type { Moment } from "moment";
import { ItemView, setIcon } from "obsidian";
import type { TFile, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";

import { TRIGGER_ON_OPEN, VIEW_TYPE_CALENDAR } from "src/constants";
import { getWeeklyNote } from "src/core/dates";
import { t } from "src/i18n";
import { getDateFromFile, noteFormat } from "src/io/notes";
import type CalendarPlugin from "src/main";
import type { ISettings } from "src/settingsData";

import Calendar from "./ui/Calendar.svelte";
import { showFileMenu } from "./ui/fileMenu";
import {
  customTagsSource,
  importantDaysSource,
  streakSource,
  tasksSource,
  wordCountSource,
} from "./ui/sources";
import { activeFile, dailyNotes, monthlyNotes, settings, weeklyNotes } from "./ui/stores";
import { TemplatePreview } from "./ui/templatePreview";
import { renderUpcoming } from "./ui/upcoming";

export default class CalendarView extends ItemView {
  private calendar: Calendar;
  private settings: ISettings;
  private toolbarEl: HTMLElement;
  private upcomingEl: HTMLElement;
  private preview: TemplatePreview;

  constructor(leaf: WorkspaceLeaf, private plugin: CalendarPlugin) {
    super(leaf);

    this.onClickDay = this.onClickDay.bind(this);
    this.onClickWeek = this.onClickWeek.bind(this);
    this.onFileCreated = this.onFileCreated.bind(this);
    this.onFileDeleted = this.onFileDeleted.bind(this);
    this.onFileModified = this.onFileModified.bind(this);
    this.onFileRenamed = this.onFileRenamed.bind(this);
    this.onFileOpen = this.onFileOpen.bind(this);
    this.onHoverDay = this.onHoverDay.bind(this);
    this.onHoverWeek = this.onHoverWeek.bind(this);
    this.onContextMenuDay = this.onContextMenuDay.bind(this);
    this.onContextMenuWeek = this.onContextMenuWeek.bind(this);

    this.preview = new TemplatePreview(() => this.settings);

    this.registerEvent(this.app.vault.on("create", this.onFileCreated));
    this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
    this.registerEvent(this.app.vault.on("modify", this.onFileModified));
    this.registerEvent(this.app.vault.on("rename", this.onFileRenamed));
    this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));

    this.settings = null;
    this.register(
      settings.subscribe((val) => {
        this.settings = val;
        // Refresh the calendar if settings change
        this.calendar?.tick();
        this.renderUpcoming();
      })
    );
    // Midnight: keep "upcoming" counters right.
    this.registerInterval(window.setInterval(() => this.renderUpcoming(), 1000 * 60 * 10));
  }

  getViewType(): string {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText(): string {
    return t("view.title");
  }

  getIcon(): string {
    return "calendar-with-checkmark";
  }

  onClose(): Promise<void> {
    this.preview.hide();
    this.calendar?.$destroy();
    return Promise.resolve();
  }

  async onOpen(): Promise<void> {
    // Integration point: external plugins can listen for `calendar:open`
    // to feed in additional sources.
    const sources = [
      customTagsSource,
      streakSource,
      wordCountSource,
      tasksSource,
      importantDaysSource,
    ];
    this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

    const root = this.contentEl;
    root.empty();
    root.addClass("cwt-view");

    this.toolbarEl = root.createDiv("cwt-toolbar");
    const menuButton = this.toolbarEl.createEl("button", {
      cls: "clickable-icon cwt-menu-button",
      attr: { "aria-label": t("menu.header") },
    });
    setIcon(menuButton, "more-horizontal");
    menuButton.addEventListener("click", (e) => {
      this.preview.hide();
      this.plugin.buildMainMenu(this.displayedMonth()).showAtMouseEvent(e);
    });

    const calendarEl = root.createDiv("cwt-calendar");
    this.calendar = new Calendar({
      target: calendarEl,
      props: {
        onClickDay: this.onClickDay,
        onClickWeek: this.onClickWeek,
        onHoverDay: this.onHoverDay,
        onHoverWeek: this.onHoverWeek,
        onContextMenuDay: this.onContextMenuDay,
        onContextMenuWeek: this.onContextMenuWeek,
        sources,
      },
    });

    // Right click on the "Month Year" title opens the same menu, scoped to
    // the displayed month.
    this.registerDomEvent(calendarEl, "contextmenu", (e: MouseEvent) => {
      const title = (e.target as HTMLElement)?.closest?.(".nav .title");
      if (!title) {
        return;
      }
      e.preventDefault();
      this.preview.hide();
      this.plugin.buildMainMenu(this.displayedMonth()).showAtMouseEvent(e);
    });

    this.upcomingEl = root.createDiv("cwt-upcoming-container");
    this.renderUpcoming();
  }

  private displayedMonth(): Moment {
    return this.calendar?.getDisplayedMonth?.() ?? window.moment();
  }

  /** Re-render metadata (important marks, dots) and the upcoming block. */
  refresh(): void {
    this.calendar?.tick();
    this.renderUpcoming();
  }

  private renderUpcoming(): void {
    if (!this.upcomingEl || !this.settings) {
      return;
    }
    renderUpcoming(
      this.upcomingEl,
      this.settings,
      (date) => void this.plugin.openPeriodic(window.moment(date, "YYYY-MM-DD"), "day", false),
      (collapsed) => {
        if (collapsed !== this.settings.upcomingCollapsed) {
          void this.plugin.writeOptions(() => ({ upcomingCollapsed: collapsed }));
        }
      }
    );
  }

  private async onClickDay(date: Moment, inNewSplit: boolean): Promise<void> {
    this.preview.hide();
    await this.plugin.openPeriodic(date, "day", inNewSplit);
  }

  private async onClickWeek(date: Moment, inNewSplit: boolean): Promise<void> {
    await this.plugin.openPeriodic(date, "week", inNewSplit);
  }

  onHoverDay(date: Moment, targetEl: EventTarget, isMetaPressed: boolean): void {
    const note = this.plugin.findDailyNote(date);
    if (isMetaPressed) {
      this.preview.hide();
      this.app.workspace.trigger(
        "link-hover",
        this,
        targetEl,
        date.format(noteFormat(this.settings, "day")),
        note?.path
      );
      return;
    }
    if (!note && this.settings.showTemplatePreview && this.settings.daily.enabled) {
      this.preview.schedule(date, targetEl);
    } else {
      this.preview.hide();
    }
  }

  onHoverWeek(date: Moment, targetEl: EventTarget, isMetaPressed: boolean): void {
    if (!isMetaPressed) {
      return;
    }
    const note = getWeeklyNote(date, get(weeklyNotes));
    this.app.workspace.trigger(
      "link-hover",
      this,
      targetEl,
      date.format(noteFormat(this.settings, "week")),
      note?.path
    );
  }

  private onContextMenuDay(date: Moment, event: MouseEvent): void {
    this.preview.hide();
    this.plugin.showDayMenu(date, event);
  }

  private onContextMenuWeek(date: Moment, event: MouseEvent): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    if (!note) {
      return;
    }
    showFileMenu(this.app, note, { x: event.pageX, y: event.pageY });
  }

  private isPeriodicFile(file: TFile): boolean {
    if (!this.settings || !(file as TFile).extension) {
      return false;
    }
    return (
      !!getDateFromFile(file, this.settings, "day") ||
      !!getDateFromFile(file, this.settings, "week") ||
      !!getDateFromFile(file, this.settings, "month")
    );
  }

  private reindex(): void {
    dailyNotes.reindex();
    weeklyNotes.reindex();
    monthlyNotes.reindex();
  }

  private onFileDeleted(file: TFile): void {
    if (this.isPeriodicFile(file)) {
      this.reindex();
      this.updateActiveFile();
    }
  }

  private onFileRenamed(file: TFile, oldPath: string): void {
    const wasNote = Object.values(get(dailyNotes)).some((f) => f === file || f.path === oldPath) ||
      Object.values(get(weeklyNotes)).some((f) => f === file || f.path === oldPath);
    if (wasNote || this.isPeriodicFile(file)) {
      this.reindex();
      this.updateActiveFile();
    }
  }

  private onFileModified(file: TFile): void {
    if (this.calendar && this.isPeriodicFile(file)) {
      this.calendar.tick();
    }
  }

  private onFileCreated(file: TFile): void {
    if (this.app.workspace.layoutReady && this.calendar && this.isPeriodicFile(file)) {
      this.reindex();
      this.calendar.tick();
    }
  }

  public onFileOpen(_file: TFile): void {
    if (this.app.workspace.layoutReady) {
      this.updateActiveFile();
    }
  }

  private updateActiveFile(): void {
    activeFile.setFile(this.app.workspace.getActiveFile());
    this.calendar?.tick();
  }

  public revealActiveNote(): void {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      return;
    }
    const info = this.plugin.noteDateOf(file);
    if (info) {
      this.calendar.$set({ displayedMonth: info.date });
    }
  }
}
