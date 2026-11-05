import type { Moment } from "moment";
import { ItemView, setIcon } from "obsidian";
import type { TFile, WorkspaceLeaf } from "obsidian";
import { get } from "svelte/store";

import { TRIGGER_ON_OPEN, VIEW_TYPE_CALENDAR } from "src/constants";
import { getWeeklyNote } from "src/core/dates";
import { t } from "src/core/i18n";
import type { ISettings } from "src/core/settings";
import { holidayStore, holidaysFor } from "src/io/holidays";
import { getDateFromFile, noteFormat } from "src/io/notes";
import type CalendarPlugin from "src/main";

import Calendar from "./Calendar.svelte";
import { buildMainMenu, showDayMenu, showHolidayMenu, showWeekMenu } from "./menus";
import {
  customTagsSource,
  holidaysSource,
  importantDaysSource,
  streakSource,
  dotsSource,
} from "./sources";
import { activeFile, dailyNotes, monthlyNotes, settings, weeklyNotes } from "./stores";
import { TemplatePreview } from "./templatePreview";
import { renderUpcoming } from "./upcoming";

export default class CalendarView extends ItemView {
  private calendar: Calendar;
  private settings: ISettings;
  private toolbarEl: HTMLElement;
  private calendarEl: HTMLElement;
  private menuButton: HTMLElement;
  private upcomingEl: HTMLElement;
  private preview: TemplatePreview;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: CalendarPlugin,
  ) {
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

    this.preview = new TemplatePreview(this.app, () => this.settings);

    this.registerEvent(this.app.vault.on("create", this.onFileCreated));
    this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
    this.registerEvent(this.app.vault.on("modify", this.onFileModified));
    this.registerEvent(this.app.vault.on("rename", this.onFileRenamed));
    this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));

    this.settings = null;
    this.register(
      settings.subscribe((val) => {
        this.settings = val;
        this.calendar?.tick();
        this.placeMenuButton();
        this.renderUpcoming();
      }),
    );
    this.register(
      holidayStore.subscribe(() => {
        this.calendar?.tick();
        this.renderUpcoming();
      }),
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
      dotsSource,
      importantDaysSource,
      holidaysSource,
    ];
    this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

    const root = this.contentEl;
    root.empty();
    root.addClass("cwt-view");

    this.toolbarEl = root.createDiv("cwt-toolbar");
    this.menuButton = createEl("button", {
      cls: "clickable-icon cwt-menu-button",
      attr: { "aria-label": t("menu.header") },
    });
    setIcon(this.menuButton, "more-horizontal");
    this.menuButton.addEventListener("click", (e) => {
      this.preview.hide();
      buildMainMenu(this.plugin, this.displayedMonth()).showAtMouseEvent(e);
    });

    const calendarEl = root.createDiv("cwt-calendar");
    this.calendarEl = calendarEl;
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
    this.placeMenuButton();
    // Put the button back if the calendar ever re-creates its header.
    const observer = new MutationObserver(() => {
      if (!this.menuButton.isConnected) {
        this.placeMenuButton();
      }
    });
    observer.observe(calendarEl, { childList: true, subtree: true });
    this.register(() => observer.disconnect());

    // Capture phase: runs before calendar-ui's own handlers.
    this.registerDomEvent(
      calendarEl,
      "click",
      (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target?.closest?.(".nav .title")) {
          // Title click opens the quick navigator (instead of "jump to today";
          // the Today button still does that).
          e.preventDefault();
          e.stopPropagation();
          this.preview.hide();
          this.plugin.showDateNavigator(this.displayedMonth(), (m) => this.goToMonth(m));
          return;
        }
        const dayEl = target?.closest?.(".day.cwt-holiday") as HTMLElement | null;
        if (dayEl && isOnHolidayMark(dayEl, e)) {
          const date = this.dateOfDayEl(dayEl);
          if (date) {
            e.preventDefault();
            e.stopPropagation();
            this.preview.hide();
            showHolidayMenu(this.plugin, date, e);
          }
        }
      },
      { capture: true },
    );

    // Right click on the "Month Year" title opens the main menu, scoped to
    // the displayed month.
    this.registerDomEvent(calendarEl, "contextmenu", (e: MouseEvent) => {
      const title = (e.target as HTMLElement)?.closest?.(".nav .title");
      if (!title) {
        return;
      }
      e.preventDefault();
      this.preview.hide();
      buildMainMenu(this.plugin, this.displayedMonth()).showAtMouseEvent(e);
    });

    this.upcomingEl = root.createDiv("cwt-upcoming-container");
    this.renderUpcoming();
  }

  /** Put the ⋯ button where the setting says (falls back to the toolbar). */
  private placeMenuButton(): void {
    if (!this.menuButton || !this.calendarEl || !this.toolbarEl) {
      return;
    }
    const pos = this.settings?.menuPosition ?? "navRight";
    const nav = this.calendarEl.querySelector(".nav");
    const right = nav?.querySelector(".right-nav");
    const btn = this.menuButton;
    let placed = false;
    // "hidden": the button stays in the (hidden) toolbar so the observer
    // below does not keep re-adding it; right click on the title still works.
    btn.toggleClass("cwt-hidden", pos === "hidden");
    if (pos === "hidden") {
      this.toolbarEl.append(btn);
      this.toolbarEl.toggleClass("is-empty", true);
      return;
    }
    if (pos === "navLeft" && right) {
      right.prepend(btn);
      placed = true;
    } else if (pos === "navRight" && right) {
      right.append(btn);
      placed = true;
    } else if (pos === "titleLeft" && nav) {
      nav.prepend(btn);
      placed = true;
    }
    if (!placed) {
      this.toolbarEl.append(btn);
    }
    btn.toggleClass("cwt-in-nav", placed);
    this.toolbarEl.toggleClass("is-empty", placed);
  }

  goToMonth(month: Moment): void {
    this.calendar?.$set({ displayedMonth: month.clone().startOf("month") });
  }

  /** The day cell's date: its position in the displayed grid. */
  private dateOfDayEl(dayEl: HTMLElement): Moment | null {
    const cells = Array.from(this.calendarEl.querySelectorAll(".calendar tbody .day"));
    const index = cells.indexOf(dayEl);
    if (index < 0) {
      return null;
    }
    const month = this.displayedMonth().clone().startOf("month");
    const gridStart = month.clone().startOf("week");
    return gridStart.add(index, "day");
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
    renderUpcoming(this.upcomingEl, this.settings, {
      onOpenDay: (date) =>
        void this.plugin.openPeriodic(window.moment(date, "YYYY-MM-DD"), "day", false),
      onToggle: (collapsed) => {
        if (collapsed !== this.settings.upcomingCollapsed) {
          void this.plugin.writeOptions(() => ({ upcomingCollapsed: collapsed }));
        }
      },
      onOpenHoliday: (path) => void this.plugin.openHoliday(path),
      onFilterChange: (filter) => void this.plugin.setUpcomingFilter(filter),
      onDismissImportant: (date, eventId) => void this.plugin.dismissImportantEvent(date, eventId),
      onDismissHoliday: (date, path) => void this.plugin.dismissHolidayUpcoming(date, path),
    });
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
        note?.path,
      );
      return;
    }
    if (!note && this.settings.showTemplatePreview && this.settings.daily.enabled) {
      this.preview.schedule(date, targetEl);
    } else if (this.settings.showHolidayMarks !== false && holidaysFor(date).length) {
      this.preview.schedule(date, targetEl, true);
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
      note?.path,
    );
  }

  private onContextMenuDay(date: Moment, event: MouseEvent): void {
    this.preview.hide();
    showDayMenu(this.plugin, date, event);
  }

  private onContextMenuWeek(date: Moment, event: MouseEvent): void {
    const note = getWeeklyNote(date, get(weeklyNotes));
    if (!note) {
      return;
    }
    showWeekMenu(this.app, note, event);
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
    const wasNote =
      Object.values(get(dailyNotes)).some((f) => f === file || f.path === oldPath) ||
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

/** The 🎉 mark sits in the top-right corner of the day (see styles.css). */
export function isOnHolidayMark(dayEl: HTMLElement, e: MouseEvent): boolean {
  const rect = dayEl.getBoundingClientRect();
  const size = Math.max(14, rect.height * 0.5);
  return e.clientX >= rect.right - size && e.clientY <= rect.top + size;
}
