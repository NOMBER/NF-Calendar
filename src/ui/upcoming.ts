import { upcomingImportantDays } from "src/core/important";
import { t } from "src/i18n";
import type { ISettings } from "src/settingsData";

import { relativeLabel } from "./importantListModal";

/** Collapsible "Upcoming important days" block under the calendar. */
export function renderUpcoming(
  containerEl: HTMLElement,
  settings: ISettings,
  onOpenDay: (date: string) => void,
  onToggle: (collapsed: boolean) => void
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
    settings.upcomingHorizonDays
  );
  if (!items.length) {
    details.createDiv({
      cls: "cwt-muted cwt-upcoming-empty",
      text: t("upcoming.empty", { days: settings.upcomingHorizonDays }),
    });
    return;
  }
  for (const item of items) {
    const row = details.createDiv("cwt-upcoming-item");
    row.createSpan({ cls: "cwt-marker", attr: { "data-cwt-color": item.day.color } });
    const main = row.createDiv("cwt-upcoming-main");
    main.createDiv({ cls: "cwt-upcoming-title", text: item.day.title || t("important.untitled") });
    main.createDiv({
      cls: "cwt-upcoming-date",
      text: window.moment(item.date, "YYYY-MM-DD").format("ddd, D MMM"),
    });
    row.createSpan({ cls: "cwt-upcoming-left", text: relativeLabel(item.daysLeft) });
    row.addEventListener("click", () => onOpenDay(item.date));
  }
}
