import { resolveMenuLayout } from "../core/menuItems";
import type { MenuItemId } from "../core/menuItems";
/** Context menus of the calendar view (header ⋯, month title, day, week). */
import type { Moment } from "moment";
import { Menu } from "obsidian";
import type { App, TFile } from "obsidian";

import { holidayAge } from "src/core/holidays";
import { t } from "src/core/i18n";
import { dayKey } from "src/core/important";
import { holidaysFor } from "src/io/holidays";
import type CalendarPlugin from "src/main";

/** Every action of the plugin (header button / right click on the month title). */
export function buildMainMenu(plugin: CalendarPlugin, displayedMonth?: Moment): Menu {
  const menu = new Menu();
  const now = window.moment();
  const month = (displayedMonth || now).clone();
  const options = plugin.options;
  const active = plugin.app.workspace.getActiveFile();
  const activeInfo = active ? plugin.noteDateOf(active) : null;
  const toggle = (key: "showHolidayMarks" | "showImportantMarks") => ({
    checked: options[key] !== false,
    fn: () => plugin.writeOptions(() => ({ [key]: !(options[key] !== false) })),
  });
  // Every item the ⋯ menu knows about; order and visibility come from
  // settings (core/menuItems). `when` hides items that make no sense now.
  const defs: Record<
    MenuItemId,
    { title: string; icon: string; fn: () => unknown; when?: boolean; checked?: boolean }
  > = {
    openYesterday: {
      title: t("cmd.openYesterday"),
      icon: "arrow-left",
      fn: () => plugin.openDailyNoteForOffset(-1),
    },
    openToday: {
      title: t("cmd.openToday"),
      icon: "calendar-check",
      fn: () => plugin.openDailyNoteForOffset(0),
    },
    openTomorrow: {
      title: t("cmd.openTomorrow"),
      icon: "arrow-right",
      fn: () => plugin.openDailyNoteForOffset(1),
    },
    openWeekly: {
      title: t("cmd.openWeekly"),
      icon: "calendar-range",
      when: options.weekly.enabled,
      fn: () => plugin.openPeriodic(now, "week", false),
    },
    openMonthly: {
      title: t("menu.openMonthly", { month: month.format("MMMM YYYY") }),
      icon: "calendar",
      when: options.monthly.enabled,
      fn: () => plugin.openPeriodic(month, "month", false),
    },
    toggleHolidays: {
      title: t("settings.showHolidayMarks"),
      icon: "party-popper",
      ...toggle("showHolidayMarks"),
    },
    toggleImportant: {
      title: t("settings.showImportantMarks"),
      icon: "circle-dot",
      ...toggle("showImportantMarks"),
    },
    missingWeek: {
      title: t("cmd.missingWeek"),
      icon: "calendar-plus",
      fn: () => plugin.createMissingDailyNotes("week"),
    },
    missingMonth: {
      title: t("cmd.missingMonth"),
      icon: "calendar-plus",
      fn: () => plugin.createMissingDailyNotes("month"),
    },
    missingDisplayedMonth: {
      title: t("menu.missingDisplayedMonth", { month: month.format("MMMM YYYY") }),
      icon: "calendar-plus",
      when: month.isAfter(now, "month"),
      fn: () => plugin.createMissingDailyNotes(month),
    },
    prevDaily: {
      title: t("cmd.prevDaily"),
      icon: "chevron-left",
      when: activeInfo?.g === "day",
      fn: () => plugin.openAdjacentDailyNote(-1),
    },
    nextDaily: {
      title: t("cmd.nextDaily"),
      icon: "chevron-right",
      when: activeInfo?.g === "day",
      fn: () => plugin.openAdjacentDailyNote(1),
    },
    applyTemplate: {
      title: t("cmd.applyTemplate"),
      icon: "file-input",
      when: !!activeInfo,
      fn: () => plugin.applyTemplateToActiveNote(),
    },
    importantList: {
      title: t("cmd.importantList"),
      icon: "star",
      fn: () => plugin.showImportantDays(),
    },
    statistics: {
      title: t("cmd.statistics"),
      icon: "bar-chart-2",
      fn: () => plugin.showStatistics(month),
    },
    settings: { title: t("cmd.settings"), icon: "settings", fn: () => plugin.openSettings() },
  };
  const { entries } = resolveMenuLayout(options.menuItems, (id) => defs[id].when !== false);
  for (const e of entries) {
    if (e === "separator") {
      menu.addSeparator();
      continue;
    }
    const d = defs[e];
    menu.addItem((i) => {
      i.setTitle(d.title).setIcon(d.icon);
      if (d.checked !== undefined) i.setChecked(d.checked);
      i.onClick(() => void d.fn());
    });
  }
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
  addHolidayItems(plugin, menu, date);
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

/** "🎉 name" items that open the day's holiday notes. */
function addHolidayItems(plugin: CalendarPlugin, menu: Menu, date: Moment): number {
  const list = holidaysFor(date);
  if (list.length) {
    menu.addSeparator();
  }
  for (const h of list) {
    const age = holidayAge(h, date);
    menu.addItem((i) =>
      i
        .setTitle(`🎉 ${h.name}${age !== null ? ` (${t("holiday.age", { age })})` : ""}`)
        .setIcon("party-popper")
        .onClick(() => void plugin.openHoliday(h.path)),
    );
  }
  return list.length;
}

/** Click on the 🎉 mark of a day: list of its holiday notes. */
export function showHolidayMenu(plugin: CalendarPlugin, date: Moment, event: MouseEvent): void {
  const menu = new Menu();
  if (addHolidayItems(plugin, menu, date)) {
    menu.showAtMouseEvent(event);
  }
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
