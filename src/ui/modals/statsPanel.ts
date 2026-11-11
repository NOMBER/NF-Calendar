/**
 * Shared month-statistics UI used by the standalone Stats modal and by the
 * in-place panel inside the Go-to-date navigator.
 */
import type { Moment } from "moment";
import { setIcon } from "obsidian";
import type { App, TFile } from "obsidian";

import { CHART_KINDS, CHART_METRICS, completionBreakdown, seriesFor } from "src/core/charts";
import { datesBetween } from "src/core/dates";
import type { IHoliday } from "src/core/holidays";
import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import { dayTitle, getDayMarks } from "src/core/important";
import type { ImportantDays } from "src/core/important";
import type { IStatsView } from "src/core/settings";
import { currentStreak, isAllTasksDone, summarizeMonth } from "src/core/stats";
import type { IDayStats } from "src/core/stats";
import { cachedTaskCount, computeNoteStats } from "src/io/noteStats";
import { renderDonut, renderSeriesChart } from "src/ui/charts";
import { applyColorVar } from "src/ui/colors";

export interface IStatsPanelDeps {
  findDailyNote: (date: Moment) => TFile | null;
  importantDays: () => ImportantDays;
  /** Called when the user picks a day; caller closes any host modal. */
  openDay: (date: Moment) => void;
  holidays: (date: Moment) => IHoliday[];
  view: () => IStatsView;
  saveView: (view: IStatsView) => void;
}

export interface IStatsPanelOptions {
  /** Optional row above the month nav (e.g. Back). */
  header?: (bar: HTMLElement) => void;
}

/** Renders statistics into an existing element (no Modal of its own). */
export class StatsPanel {
  private month: Moment;
  private renderToken = 0;
  private view: IStatsView;
  private stats: IDayStats[] | null = null;
  private tableWrap: HTMLElement | null = null;
  private chartsWrap: HTMLElement | null = null;
  private optionsEl: HTMLElement | null = null;

  constructor(
    private app: App,
    private host: HTMLElement,
    private deps: IStatsPanelDeps,
    month: Moment | undefined,
    private opts: IStatsPanelOptions = {},
  ) {
    this.month = (month || window.moment()).clone().startOf("month");
    this.view = { ...deps.view() };
  }

  getMonth(): Moment {
    return this.month.clone();
  }

  destroy(): void {
    this.renderToken++;
    this.host.empty();
    this.tableWrap = null;
    this.chartsWrap = null;
    this.optionsEl = null;
  }

  async render(): Promise<void> {
    const token = ++this.renderToken;
    const { host } = this;
    host.empty();

    if (this.opts.header) {
      const bar = host.createDiv("cwt-stats-header");
      this.opts.header(bar);
    }

    const nav = host.createDiv("cwt-stats-nav");
    const prev = nav.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("stats.prev") },
    });
    setIcon(prev, "chevron-left");
    nav.createEl("h3", { cls: "cwt-stats-month", text: this.month.format("MMMM YYYY") });
    const next = nav.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("stats.next") },
    });
    setIcon(next, "chevron-right");
    prev.addEventListener("click", () => {
      this.month = this.month.clone().subtract(1, "month");
      void this.render();
    });
    next.addEventListener("click", () => {
      this.month = this.month.clone().add(1, "month");
      void this.render();
    });

    this.stats = null;
    this.renderControls(host);
    this.tableWrap = host.createDiv("cwt-stats-table-wrap");
    this.chartsWrap = host.createDiv("cwt-stats-charts");
    this.applyMode();
    const table = this.tableWrap.createEl("table", { cls: "cwt-stats-table" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: t("stats.colDay") });
    head.createEl("th", { text: t("stats.colWords") });
    head.createEl("th", { text: t("stats.colDone") });
    head.createEl("th", { text: t("stats.colOpen") });
    const body = table.createEl("tbody");
    const summaryEl = host.createDiv("cwt-stats-summary");
    summaryEl.setText(t("stats.loading"));

    const days = datesBetween(this.month, this.month.clone().endOf("month"));
    const important = this.deps.importantDays();
    const today = window.moment();
    const stats: IDayStats[] = [];
    let holidayDays = 0;

    for (const date of days) {
      if (token !== this.renderToken) return;
      const row = body.createEl("tr", { cls: "cwt-stats-row" });
      if (date.isSame(today, "day")) row.addClass("is-today");
      const dayCell = row.createEl("td", { cls: "cwt-stats-day" });
      dayCell.createSpan({ text: date.format("dd D") });
      const marks = getDayMarks(window.moment, date, important);
      if (marks.important) {
        const marker = dayCell.createSpan({
          cls: "cwt-marker",
          attr: {
            "data-cwt-color": marks.important.color,
            "aria-label": dayTitle(marks.important) || t("important.untitled"),
          },
        });
        applyColorVar(marker, marks.important.color);
        const title = dayTitle(marks.important);
        if (title) {
          dayCell.createSpan({ cls: "cwt-stats-important-title", text: title });
        }
      }
      const holidays = this.deps.holidays(date);
      if (holidays.length) {
        holidayDays++;
        dayCell.createSpan({
          cls: "cwt-stats-holiday",
          text: "🎉",
          attr: { "aria-label": holidays.map((h) => h.name).join("\n") },
        });
      }
      const wordsCell = row.createEl("td");
      const doneCell = row.createEl("td");
      const openCell = row.createEl("td");
      row.addEventListener("click", () => this.deps.openDay(date));

      const file = this.deps.findDailyNote(date);
      if (!file) {
        stats.push({
          date: date.format("YYYY-MM-DD"),
          hasNote: false,
          words: 0,
          tasksDone: 0,
          tasksOpen: 0,
        });
        row.addClass("is-empty");
        continue;
      }
      try {
        const s = await computeNoteStats(this.app, file);
        stats.push({ date: date.format("YYYY-MM-DD"), hasNote: true, ...s });
        if (isAllTasksDone(s)) {
          row.addClass("is-all-done");
          dayCell.createSpan({
            cls: "cwt-stats-done",
            text: "✓",
            attr: { "aria-label": t("stats.allDone") },
          });
        }
        wordsCell.setText(String(s.words));
        doneCell.setText(String(s.tasksDone));
        openCell.setText(String(s.tasksOpen));
      } catch (err) {
        console.warn("[Calendar] stats failed for", file.path, err);
        stats.push({
          date: date.format("YYYY-MM-DD"),
          hasNote: true,
          words: 0,
          tasksDone: 0,
          tasksOpen: 0,
        });
      }
    }
    if (token !== this.renderToken) return;
    this.stats = stats;
    this.renderCharts();
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
    add(t("stats.allDoneDays"), String(sum.allDoneDays));
    if (holidayDays) add(t("stats.holidayDays"), String(holidayDays));
    const streak = this.streak(stats, today);
    if (streak !== null) add(t("stats.streak"), t("stats.streakValue", { count: streak }));
  }

  private renderControls(parent: HTMLElement): void {
    const bar = parent.createDiv("cwt-stats-controls");
    const modes = bar.createDiv("cwt-nav-modes");
    const buttons: HTMLElement[] = [];
    (["table", "charts"] as const).forEach((mode) => {
      const b = modes.createEl("button", {
        cls: "cwt-nav-mode",
        text: t(mode === "table" ? "stats.viewTable" : "stats.viewCharts"),
      });
      buttons.push(b);
      b.toggleClass("is-active", this.view.mode === mode);
      b.addEventListener("click", () => {
        this.view = { ...this.view, mode };
        buttons.forEach((x) => x.toggleClass("is-active", x === b));
        this.saveAndRedraw();
      });
    });
    const chartOpts = bar.createDiv("cwt-stats-chart-options");
    const metric = chartOpts.createEl("select", { cls: "dropdown" });
    CHART_METRICS.forEach((m) =>
      metric.createEl("option", { value: m, text: t(`chart.metric.${m}` as I18nKey) }),
    );
    metric.value = this.view.metric;
    const kind = chartOpts.createEl("select", { cls: "dropdown" });
    CHART_KINDS.forEach((k) =>
      kind.createEl("option", { value: k, text: t(`chart.kind.${k}` as I18nKey) }),
    );
    kind.value = this.view.kind;
    kind.disabled = this.view.metric === "completion";
    metric.addEventListener("change", () => {
      this.view = { ...this.view, metric: metric.value as IStatsView["metric"] };
      kind.disabled = this.view.metric === "completion";
      this.saveAndRedraw();
    });
    kind.addEventListener("change", () => {
      this.view = { ...this.view, kind: kind.value as IStatsView["kind"] };
      this.saveAndRedraw();
    });
    this.optionsEl = chartOpts;
  }

  private saveAndRedraw(): void {
    this.deps.saveView(this.view);
    this.applyMode();
    this.renderCharts();
  }

  private applyMode(): void {
    const charts = this.view.mode === "charts";
    this.tableWrap?.toggle(!charts);
    this.chartsWrap?.toggle(charts);
    this.optionsEl?.toggle(charts);
  }

  private renderCharts(): void {
    const el = this.chartsWrap;
    if (!el) return;
    el.empty();
    if (this.view.mode !== "charts") return;
    if (!this.stats) {
      el.createDiv({ cls: "cwt-muted", text: t("stats.loading") });
      return;
    }
    const label = (key: string) => t(`chart.series.${key}` as I18nKey);
    if (this.view.metric === "completion") {
      renderDonut(el, completionBreakdown(this.stats), label);
      return;
    }
    const stats = this.stats;
    renderSeriesChart(el, seriesFor(stats, this.view.metric), this.view.kind, label, (i) =>
      window.moment(stats[i].date, "YYYY-MM-DD").format("dd D"),
    );
  }

  private streak(stats: IDayStats[], today: Moment): number | null {
    const monthEnd = this.month.clone().endOf("month").startOf("day");
    if (this.month.isAfter(today, "day")) return null;
    const isCurrentMonth = this.month.isSame(today, "month");
    const anchor = isCurrentMonth ? today.clone().startOf("day") : monthEnd;
    const byDate = new Map(stats.map((s) => [s.date, s]));
    return currentStreak(
      (daysAgo) => {
        const date = anchor.clone().subtract(daysAgo, "day");
        const known = byDate.get(date.format("YYYY-MM-DD"));
        if (known) return known.hasNote && isAllTasksDone(known);
        const file = this.deps.findDailyNote(date);
        if (!file) return false;
        const tasks = cachedTaskCount(this.app, file);
        return isAllTasksDone({ tasksDone: tasks.done, tasksOpen: tasks.open });
      },
      { pendingAnchor: isCurrentMonth },
    );
  }
}
