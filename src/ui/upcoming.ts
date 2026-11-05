import { Menu } from "obsidian";

import { holidayAge, upcomingHolidays } from "src/core/holidays";
import { t } from "src/core/i18n";
import {
  holidayDismissKey,
  importantDismissKey,
  isDismissed,
  upcomingImportantDays,
} from "src/core/important";
import type { UpcomingFilter } from "src/core/important";
import type { ISettings } from "src/core/settings";

import { holidayStore } from "src/io/holidays";
import { relativeLabel } from "src/ui/modals/importantList";
import { get } from "svelte/store";

export interface IUpcomingActions {
  onOpenDay: (date: string) => void;
  onToggle: (collapsed: boolean) => void;
  onOpenHoliday?: (path: string) => void;
  onFilterChange: (filter: UpcomingFilter) => void;
  onDismissImportant: (date: string, eventId: string) => void;
  onDismissHoliday: (date: string, path: string) => void;
}

/** Collapsible "Upcoming important days" block under the calendar. */
export function renderUpcoming(
  containerEl: HTMLElement,
  settings: ISettings,
  actions: IUpcomingActions,
): void {
  containerEl.empty();
  if (!settings.showUpcoming) {
    return;
  }
  const details = containerEl.createEl("details", { cls: "cwt-upcoming" });
  details.open = !settings.upcomingCollapsed;
  const summary = details.createEl("summary", { cls: "cwt-upcoming-summary" });
  summary.createSpan({ cls: "cwt-upcoming-summary-label", text: t("upcoming.title") });
  // When the control is hidden, always show everything (saved filter value is kept).
  const activeFilter: UpcomingFilter = settings.hideUpcomingFilter
    ? "all"
    : settings.upcomingFilter || "all";
  if (!settings.hideUpcomingFilter) {
    const filter = summary.createEl("select", {
      cls: "dropdown cwt-upcoming-filter",
      attr: { "aria-label": t("upcoming.filterAria") },
    });
    const opts: Array<[UpcomingFilter, string]> = [
      ["all", t("upcoming.filterAll")],
      ["holidays", t("upcoming.filterHolidays")],
      ["important", t("upcoming.filterImportant")],
    ];
    for (const [value, label] of opts) {
      filter.createEl("option", { text: label, attr: { value } });
    }
    filter.value = settings.upcomingFilter || "all";
    // Keep the <details> from toggling when using the filter.
    const stopToggle = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    filter.addEventListener("click", stopToggle);
    filter.addEventListener("mousedown", stopToggle);
    filter.addEventListener("pointerdown", stopToggle);
    filter.addEventListener("change", (e) => {
      e.stopPropagation();
      actions.onFilterChange(filter.value as UpcomingFilter);
    });
  }
  details.addEventListener("toggle", () => actions.onToggle(!details.open));

  const showImportant = activeFilter !== "holidays";
  const showHolidays = activeFilter !== "important";
  const dismissed = settings.dismissedUpcoming;

  const items = showImportant
    ? upcomingImportantDays(
        window.moment,
        window.moment(),
        settings.importantDays,
        settings.upcomingHorizonDays,
      ).filter((item) => !isDismissed(dismissed, importantDismissKey(item.date, item.event.id)))
    : [];
  const holidays = showHolidays
    ? upcomingHolidays(get(holidayStore).index, window.moment(), settings.upcomingHorizonDays)
    : [];

  type Row = { daysLeft: number; order: number; render: () => void };
  const rows: Row[] = [];
  items.forEach((item, n) =>
    rows.push({
      daysLeft: item.daysLeft,
      order: n,
      render: () => {
        const row = details.createDiv("cwt-upcoming-item");
        row.createSpan({ cls: "cwt-marker", attr: { "data-cwt-color": item.day.color } });
        const main = row.createDiv("cwt-upcoming-main");
        main.createDiv({
          cls: "cwt-upcoming-title",
          text: item.event.title || t("important.untitled"),
        });
        main.createDiv({
          cls: "cwt-upcoming-date",
          text: window.moment(item.date, "YYYY-MM-DD").format("ddd, D MMM"),
        });
        row.createSpan({ cls: "cwt-upcoming-left", text: relativeLabel(item.daysLeft) });
        row.addEventListener("click", () => actions.onOpenDay(item.date));
        bindDismiss(row, () => actions.onDismissImportant(item.date, item.event.id));
      },
    }),
  );
  for (const up of holidays) {
    const dateKey = up.date.format("YYYY-MM-DD");
    for (const h of up.holidays) {
      if (isDismissed(dismissed, holidayDismissKey(dateKey, h.path))) {
        continue;
      }
      rows.push({
        daysLeft: up.daysLeft,
        order: 10000 + rows.length,
        render: () => {
          const row = details.createDiv("cwt-upcoming-item cwt-upcoming-holiday");
          row.createSpan({ cls: "cwt-holiday-icon", text: "🎉" });
          const main = row.createDiv("cwt-upcoming-main");
          const age = holidayAge(h, up.date);
          main.createDiv({
            cls: "cwt-upcoming-title",
            text: age !== null ? `${h.name} (${t("holiday.age", { age })})` : h.name,
          });
          main.createDiv({ cls: "cwt-upcoming-date", text: up.date.format("ddd, D MMM") });
          row.createSpan({ cls: "cwt-upcoming-left", text: relativeLabel(up.daysLeft) });
          row.setAttr("aria-label", h.path);
          row.addEventListener("click", () =>
            actions.onOpenHoliday ? actions.onOpenHoliday(h.path) : actions.onOpenDay(dateKey),
          );
          bindDismiss(row, () => actions.onDismissHoliday(dateKey, h.path));
        },
      });
    }
  }

  if (!rows.length) {
    details.createDiv({
      cls: "cwt-muted cwt-upcoming-empty",
      text: t("upcoming.empty", { days: settings.upcomingHorizonDays }),
    });
    return;
  }
  rows.sort((a, b) => a.daysLeft - b.daysLeft || a.order - b.order).forEach((r) => r.render());
}

/** Right-click or long-press → Complete / dismiss. */
function bindDismiss(row: HTMLElement, onDismiss: () => void): void {
  const open = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = new Menu();
    menu.addItem((i) =>
      i
        .setTitle(t("upcoming.dismiss"))
        .setIcon("check")
        .onClick(() => onDismiss()),
    );
    if (e instanceof MouseEvent) {
      menu.showAtMouseEvent(e);
    } else if (e instanceof TouchEvent && e.touches[0]) {
      menu.showAtPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else {
      const r = row.getBoundingClientRect();
      menu.showAtPosition({ x: r.left + r.width / 2, y: r.bottom });
    }
  };
  row.addEventListener("contextmenu", open);
  let pressTimer: number | null = null;
  row.addEventListener(
    "touchstart",
    (e) => {
      pressTimer = window.setTimeout(() => {
        pressTimer = null;
        open(e);
      }, 550);
    },
    { passive: true },
  );
  const clear = () => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  };
  row.addEventListener("touchend", clear);
  row.addEventListener("touchmove", clear);
  row.addEventListener("touchcancel", clear);
}
