import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import { allImportantEvents, daysBetween } from "src/core/important";
import type { ImportantDays } from "src/core/important";

/** List of all important events with "open note" and "edit" actions. */
export class ImportantListModal extends Modal {
  constructor(
    app: App,
    private getDays: () => ImportantDays,
    private onOpenDay: (date: string) => void,
    private onEditDay: (date: string, refresh: () => void) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t("important.listTitle"));
    this.render();
  }

  render = (): void => {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("cwt-important-list");
    const items = allImportantEvents(this.getDays());
    if (!items.length) {
      contentEl.createEl("p", { cls: "cwt-muted", text: t("important.listEmpty") });
      return;
    }
    const today = window.moment();
    for (const { date, day, event } of items) {
      const left = daysBetween(window.moment, today, date);
      const row = contentEl.createDiv("cwt-upcoming-item");
      if (left < 0) {
        row.addClass("is-past");
      }
      row.createSpan({ cls: "cwt-marker", attr: { "data-cwt-color": day.color } });
      const main = row.createDiv("cwt-upcoming-main");
      main.createDiv({
        cls: "cwt-upcoming-title",
        text: event.title || t("important.untitled"),
      });
      main.createDiv({
        cls: "cwt-upcoming-date",
        text: `${window.moment(date, "YYYY-MM-DD").format("ddd, LL")} · ${relativeLabel(left)}`,
      });
      row.addEventListener("click", () => {
        this.close();
        this.onOpenDay(date);
      });
      const edit = row.createEl("button", { cls: "cwt-small-button", text: t("important.edit") });
      edit.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onEditDay(date, this.render);
      });
    }
  };

  onClose(): void {
    this.contentEl.empty();
  }
}

export function relativeLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    return t("important.past");
  }
  if (daysLeft === 0) {
    return t("upcoming.today");
  }
  if (daysLeft === 1) {
    return t("upcoming.tomorrow");
  }
  return t("upcoming.inDays", { days: daysLeft });
}
