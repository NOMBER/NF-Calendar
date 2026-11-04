import { holidayAge, upcomingHolidays } from "src/core/holidays";
import { t } from "src/core/i18n";
import { upcomingImportantDays } from "src/core/important";
import type { ISettings } from "src/core/settings";

import { holidayStore } from "src/io/holidays";
import { relativeLabel } from "src/ui/modals/importantList";
import { get } from "svelte/store";

/** Collapsible "Upcoming important days" block under the calendar. */
export function renderUpcoming(
  containerEl: HTMLElement,
  settings: ISettings,
  onOpenDay: (date: string) => void,
  onToggle: (collapsed: boolean) => void,
  onOpenHoliday?: (path: string) => void,
): void {
  containerEl.empty();
  if (!settings.showUpcoming) {
    return;
  }
  const details = containerEl.createEl("details", { cls: "cwt-upcoming" });
  details.open = !settings.upcomingCollapsed;
  details.createEl("summary", { text: t("upcoming.title") });
  details.addEventListener("toggle", () => onToggle(!details.open));

  const items = upcomingImportantDays(
    window.moment,
    window.moment(),
    settings.importantDays,
    settings.upcomingHorizonDays,
  );
  const holidays = upcomingHolidays(
    get(holidayStore).index,
    window.moment(),
    settings.upcomingHorizonDays,
  );
  if (!items.length && !holidays.length) {
    details.createDiv({
      cls: "cwt-muted cwt-upcoming-empty",
      text: t("upcoming.empty", { days: settings.upcomingHorizonDays }),
    });
    return;
  }
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
          text: item.day.title || t("important.untitled"),
        });
        main.createDiv({
          cls: "cwt-upcoming-date",
          text: window.moment(item.date, "YYYY-MM-DD").format("ddd, D MMM"),
        });
        row.createSpan({ cls: "cwt-upcoming-left", text: relativeLabel(item.daysLeft) });
        row.addEventListener("click", () => onOpenDay(item.date));
      },
    }),
  );
  for (const up of holidays) {
    for (const h of up.holidays) {
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
            onOpenHoliday ? onOpenHoliday(h.path) : onOpenDay(up.date.format("YYYY-MM-DD")),
          );
        },
      });
    }
  }
  rows.sort((a, b) => a.daysLeft - b.daysLeft || a.order - b.order).forEach((r) => r.render());
}
