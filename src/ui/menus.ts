/** Context menus of the calendar view (header ⋯, month title, day, week). */
import type { Moment } from "moment";
import { Menu } from "obsidian";
import type { App, TFile } from "obsidian";

import { t } from "src/core/i18n";
import { dayKey } from "src/core/important";
import type CalendarPlugin from "src/main";

/** Every action of the plugin (header button / right click on the month title). */
export function buildMainMenu(plugin: CalendarPlugin, displayedMonth?: Moment): Menu {
  const menu = new Menu();
  const now = window.moment();
  const month = (displayedMonth || now).clone();
  const options = plugin.options;
  const item = (title: string, icon: string, fn: () => unknown) =>
    menu.addItem((i) =>
      i
        .setTitle(title)
        .setIcon(icon)
        .onClick(() => void fn()),
    );

  item(t("cmd.openYesterday"), "arrow-left", () => plugin.openDailyNoteForOffset(-1));
  item(t("cmd.openToday"), "calendar-check", () => plugin.openDailyNoteForOffset(0));
  item(t("cmd.openTomorrow"), "arrow-right", () => plugin.openDailyNoteForOffset(1));
  if (options.weekly.enabled) {
    item(t("cmd.openWeekly"), "calendar-range", () => plugin.openPeriodic(now, "week", false));
  }
  if (options.monthly.enabled) {
    item(t("menu.openMonthly", { month: month.format("MMMM YYYY") }), "calendar", () =>
      plugin.openPeriodic(month, "month", false),
    );
  }
  menu.addSeparator();
  item(t("cmd.missingWeek"), "calendar-plus", () => plugin.createMissingDailyNotes("week"));
  item(t("cmd.missingMonth"), "calendar-plus", () => plugin.createMissingDailyNotes("month"));
  if (month.isAfter(now, "month")) {
    item(
      t("menu.missingDisplayedMonth", { month: month.format("MMMM YYYY") }),
      "calendar-plus",
      () => plugin.createMissingDailyNotes(month),
    );
  }
  const active = plugin.app.workspace.getActiveFile();
  const activeInfo = active ? plugin.noteDateOf(active) : null;
  if (activeInfo?.g === "day") {
    item(t("cmd.prevDaily"), "chevron-left", () => plugin.openAdjacentDailyNote(-1));
    item(t("cmd.nextDaily"), "chevron-right", () => plugin.openAdjacentDailyNote(1));
  }
  if (activeInfo) {
    item(t("cmd.applyTemplate"), "file-input", () => plugin.applyTemplateToActiveNote());
  }
  menu.addSeparator();
  item(t("cmd.importantList"), "star", () => plugin.showImportantDays());
  item(t("cmd.statistics"), "bar-chart-2", () => plugin.showStatistics(month));
  item(t("cmd.settings"), "settings", () => plugin.openSettings());
  return menu;
}

/** Right click on a day cell. */
export function showDayMenu(plugin: CalendarPlugin, date: Moment, event: MouseEvent): void {
  const menu = new Menu();
  const note = plugin.findDailyNote(date);
  const important = plugin.options.importantDays[dayKey(date)];
  const item = (title: string, icon: string, fn: () => unknown) =>
    menu.addItem((i) =>
      i
        .setTitle(title)
        .setIcon(icon)
        .onClick(() => void fn()),
    );

  if (note) {
    item(t("menu.openNote"), "file-text", () => plugin.openPeriodic(date, "day", false));
    item(t("menu.openInSplit"), "separator-vertical", () => plugin.openPeriodic(date, "day", true));
    item(t("menu.applyTemplate"), "file-input", () =>
      plugin.applyTemplateToNote(note, date, "day"),
    );
  } else if (plugin.options.daily.enabled) {
    item(t("menu.createNote"), "file-plus", () => plugin.openPeriodic(date, "day", false));
  }
  menu.addSeparator();
  item(important ? t("menu.editImportant") : t("menu.markImportant"), "star", () =>
    plugin.openImportantDayModal(date),
  );
  if (important) {
    item(t("menu.removeImportant"), "star-off", () => plugin.removeImportantDay(date));
  }
  if (note) {
    menu.addSeparator();
    addFileItems(plugin.app, menu, note);
  }
  menu.showAtMouseEvent(event);
}

/** Right click on a week number (only when the weekly note exists). */
export function showWeekMenu(app: App, note: TFile, event: MouseEvent): void {
  const menu = new Menu();
  addFileItems(app, menu, note);
  menu.showAtMouseEvent(event);
}

/** "Delete" (Obsidian's own confirmation) + items other plugins add to file menus. */
function addFileItems(app: App, menu: Menu, note: TFile): void {
  menu.addItem((i) =>
    i
      .setTitle(t("menu.delete"))
      .setIcon("trash")
      .onClick(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (app as any).fileManager.promptForFileDeletion(note);
      }),
  );
  app.workspace.trigger("file-menu", menu, note, "calendar-context-menu", null);
}
