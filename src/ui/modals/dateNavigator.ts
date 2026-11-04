import type { Moment } from "moment";
import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";

export interface IDateNavigatorDeps {
  month: Moment;
  goToMonth: (month: Moment) => void;
  showStats: (month: Moment) => void;
  openDay: (date: Moment) => void;
  hasNote: (date: Moment) => boolean;
}

type Target = "calendar" | "stats";

/**
 * Quick navigation opened by a click on the "Month Year" title: year picker
 * (arrows, typed year or a 12-year grid), a 12-month grid and a "go to
 * date" field. A Modal so it works the same on mobile.
 */
export class DateNavigatorModal extends Modal {
  private year: number;
  private target: Target = "calendar";
  private yearGrid = false;

  constructor(
    app: App,
    private deps: IDateNavigatorDeps,
  ) {
    super(app);
    this.year = deps.month.year();
  }

  onOpen(): void {
    this.modalEl.addClass("cwt-nav-modal");
    this.titleEl.setText(t("navigator.title"));
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Mode: what a month click does.
    const modes = contentEl.createDiv("cwt-nav-modes");
    (["calendar", "stats"] as Target[]).forEach((m) => {
      const b = modes.createEl("button", {
        cls: "cwt-nav-mode",
        text: t(m === "calendar" ? "navigator.toCalendar" : "navigator.toStats"),
      });
      b.toggleClass("is-active", this.target === m);
      b.setAttr("aria-pressed", String(this.target === m));
      b.addEventListener("click", () => {
        this.target = m;
        this.render();
      });
    });

    // Year row.
    const yearRow = contentEl.createDiv("cwt-nav-year");
    const prev = yearRow.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("navigator.prevYear") },
    });
    setIcon(prev, "chevron-left");
    const input = yearRow.createEl("input", {
      type: "number",
      cls: "cwt-nav-year-input",
      attr: { min: "1000", max: "9999", "aria-label": t("navigator.year") },
    });
    input.value = String(this.year);
    const gridBtn = yearRow.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("navigator.yearGrid") },
    });
    setIcon(gridBtn, "layout-grid");
    const next = yearRow.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("navigator.nextYear") },
    });
    setIcon(next, "chevron-right");
    const setYear = (y: number) => {
      if (Number.isInteger(y) && y >= 1000 && y <= 9999) {
        this.year = y;
        this.render();
      }
    };
    prev.addEventListener("click", () => setYear(this.year - (this.yearGrid ? 12 : 1)));
    next.addEventListener("click", () => setYear(this.year + (this.yearGrid ? 12 : 1)));
    input.addEventListener("change", () => setYear(Number(input.value)));
    gridBtn.addEventListener("click", () => {
      this.yearGrid = !this.yearGrid;
      this.render();
    });

    const today = window.moment();
    const grid = contentEl.createDiv("cwt-nav-grid");
    if (this.yearGrid) {
      const first = this.year - 5;
      for (let y = first; y < first + 12; y++) {
        const b = grid.createEl("button", { cls: "cwt-nav-cell", text: String(y) });
        b.toggleClass("is-current", y === today.year());
        b.toggleClass("is-active", y === this.year);
        b.addEventListener("click", () => {
          this.yearGrid = false;
          setYear(y);
        });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const month = window.moment({ year: this.year, month: m, day: 1 });
        const b = grid.createEl("button", { cls: "cwt-nav-cell", text: month.format("MMM") });
        b.toggleClass("is-current", month.isSame(today, "month"));
        b.toggleClass("is-active", month.isSame(this.deps.month, "month"));
        b.addEventListener("click", () => {
          this.close();
          if (this.target === "stats") {
            this.deps.showStats(month);
          } else {
            this.deps.goToMonth(month);
          }
        });
      }
    }

    // Go to a specific date.
    const dateRow = contentEl.createDiv("cwt-nav-date");
    const dateInput = dateRow.createEl("input", {
      type: "date",
      cls: "cwt-date-input",
      attr: { "aria-label": t("navigator.date") },
    });
    dateInput.value = today.format("YYYY-MM-DD");
    const status = contentEl.createDiv("cwt-nav-status setting-item-description");
    const parse = () => {
      const d = window.moment(dateInput.value, "YYYY-MM-DD", true);
      return d.isValid() ? d : null;
    };
    const updateStatus = () => {
      const d = parse();
      status.setText(
        d ? t(this.deps.hasNote(d) ? "navigator.noteExists" : "navigator.noteNew") : "",
      );
    };
    dateInput.addEventListener("input", updateStatus);
    updateStatus();
    const open = dateRow.createEl("button", { cls: "mod-cta", text: t("navigator.openDay") });
    open.addEventListener("click", () => {
      const d = parse();
      if (!d) {
        status.setText(t("navigator.badDate"));
        return;
      }
      this.close();
      this.deps.goToMonth(d.clone().startOf("month"));
      this.deps.openDay(d);
    });
    const todayBtn = dateRow.createEl("button", { text: t("navigator.today") });
    todayBtn.addEventListener("click", () => {
      this.close();
      this.deps.goToMonth(window.moment().startOf("month"));
    });
  }
}
