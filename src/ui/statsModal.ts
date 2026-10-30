import type { Moment } from "moment";
import { Modal, setIcon } from "obsidian";
import type { App, TFile } from "obsidian";

import { datesBetween } from "src/core/dates";
import { getDayMarks } from "src/core/important";
import type { ImportantDays } from "src/core/important";
import { countTasks, countTasksFromListItems, getWordCount, summarizeMonth } from "src/core/stats";
import type { IDayStats } from "src/core/stats";
import { t } from "src/i18n";

export interface IStatsDeps {
  findDailyNote: (date: Moment) => TFile | null;
  importantDays: () => ImportantDays;
  openDay: (date: Moment) => void;
}

/** Words and tasks of a note: metadataCache for tasks when available, cachedRead for words. */
export async function computeNoteStats(
  app: App,
  file: TFile
): Promise<{ words: number; tasksDone: number; tasksOpen: number }> {
  const text = await app.vault.cachedRead(file);
  const cache = app.metadataCache.getFileCache(file);
  const tasks = cache?.listItems
    ? countTasksFromListItems(cache.listItems)
    : countTasks(text);
  return { words: getWordCount(text), tasksDone: tasks.done, tasksOpen: tasks.open };
}

/**
 * Month statistics in a modal (works the same on desktop and mobile):
 * per-day words / done / open tasks, important marks, monthly totals.
 */
export class StatsModal extends Modal {
  private month: Moment;
  private renderToken = 0;

  constructor(app: App, private deps: IStatsDeps, month?: Moment) {
    super(app);
    this.month = (month || window.moment()).clone().startOf("month");
  }

  onOpen(): void {
    this.modalEl.addClass("cwt-stats-modal");
    this.titleEl.setText(t("stats.title"));
    void this.render();
  }

  onClose(): void {
    this.renderToken++;
    this.contentEl.empty();
  }

  private async render(): Promise<void> {
    const token = ++this.renderToken;
    const { contentEl } = this;
    contentEl.empty();

    const nav = contentEl.createDiv("cwt-stats-nav");
    const prev = nav.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("stats.prev") } });
    setIcon(prev, "chevron-left");
    nav.createEl("h3", { cls: "cwt-stats-month", text: this.month.format("MMMM YYYY") });
    const next = nav.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("stats.next") } });
    setIcon(next, "chevron-right");
    prev.addEventListener("click", () => {
      this.month = this.month.clone().subtract(1, "month");
      void this.render();
    });
    next.addEventListener("click", () => {
      this.month = this.month.clone().add(1, "month");
      void this.render();
    });

    const table = contentEl.createEl("table", { cls: "cwt-stats-table" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: t("stats.colDay") });
    head.createEl("th", { text: t("stats.colWords") });
    head.createEl("th", { text: t("stats.colDone") });
    head.createEl("th", { text: t("stats.colOpen") });
    const body = table.createEl("tbody");
    const summaryEl = contentEl.createDiv("cwt-stats-summary");
    summaryEl.setText(t("stats.loading"));

    const days = datesBetween(this.month, this.month.clone().endOf("month"));
    const important = this.deps.importantDays();
    const today = window.moment();
    const stats: IDayStats[] = [];

    for (const date of days) {
      if (token !== this.renderToken) {
        return; // month changed or modal closed
      }
      const row = body.createEl("tr", { cls: "cwt-stats-row" });
      if (date.isSame(today, "day")) {
        row.addClass("is-today");
      }
      const dayCell = row.createEl("td", { cls: "cwt-stats-day" });
      dayCell.createSpan({ text: date.format("dd D") });
      const marks = getDayMarks(window.moment, date, important);
      if (marks.important) {
        dayCell.createSpan({
          cls: "cwt-marker",
          attr: { "data-cwt-color": marks.important.color, "aria-label": marks.important.title || t("important.untitled") },
        });
        if (marks.important.title) {
          dayCell.createSpan({ cls: "cwt-stats-important-title", text: marks.important.title });
        }
      }
      const wordsCell = row.createEl("td");
      const doneCell = row.createEl("td");
      const openCell = row.createEl("td");
      row.addEventListener("click", () => {
        this.close();
        this.deps.openDay(date);
      });

      const file = this.deps.findDailyNote(date);
      if (!file) {
        stats.push({ date: date.format("YYYY-MM-DD"), hasNote: false, words: 0, tasksDone: 0, tasksOpen: 0 });
        row.addClass("is-empty");
        continue;
      }
      try {
        const s = await computeNoteStats(this.app, file);
        stats.push({ date: date.format("YYYY-MM-DD"), hasNote: true, ...s });
        wordsCell.setText(String(s.words));
        doneCell.setText(String(s.tasksDone));
        openCell.setText(String(s.tasksOpen));
      } catch (err) {
        console.warn("[Calendar] stats failed for", file.path, err);
        stats.push({ date: date.format("YYYY-MM-DD"), hasNote: true, words: 0, tasksDone: 0, tasksOpen: 0 });
      }
    }
    if (token !== this.renderToken) {
      return;
    }
    const sum = summarizeMonth(stats);
    summaryEl.empty();
    const add = (label: string, value: string) => {
      const line = summaryEl.createDiv("cwt-stats-summary-line");
      line.createSpan({ text: label });
      line.createSpan({ cls: "cwt-stats-value", text: value });
    };
    add(t("stats.totalWords"), String(sum.totalWords));
    add(t("stats.avgPerDay"), String(sum.avgWordsPerDay));
    add(t("stats.avgPerNote"), String(sum.avgWordsPerNote));
    add(t("stats.daysWithNotes"), `${sum.daysWithNotes} / ${sum.daysInMonth}`);
    add(t("stats.tasks"), `${sum.tasksDone} / ${sum.tasksTotal}`);
  }
}
