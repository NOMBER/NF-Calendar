import type { Moment } from "moment";
import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { RandomScope } from "src/core/random";

export interface IDateNavigatorDeps {
  month: Moment;
  goToMonth: (month: Moment) => void;
  showStats: (month: Moment) => void;
  openDay: (date: Moment) => void;
  hasNote: (date: Moment) => boolean;
  /** Resolves true when a note was opened. */
  openRandom: (scope: RandomScope, skipEmpty: boolean) => Promise<boolean>;
}

type RandomKind = RandomScope["kind"];
/** Remembered for the session (not saved). */
const randomState = { kind: "all" as RandomKind, month: 0, days: 30, skipEmpty: false };

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

    this.renderRandom(today);
  }

  /** "Open random note": scope (all / chosen year / month / last N days) + skip empty. */
  private renderRandom(today: Moment): void {
    const row = this.contentEl.createDiv("cwt-nav-random");
    const kind = row.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": t("navigator.randomScope") },
    });
    const kinds: [RandomKind, string][] = [
      ["all", t("navigator.randomAll")],
      ["year", t("navigator.randomYear", { year: String(this.year) })],
      ["month", t("navigator.randomMonth", { year: String(this.year) })],
      ["lastDays", t("navigator.randomLast")],
    ];
    kinds.forEach(([v, label]) => kind.createEl("option", { value: v, text: label }));
    kind.value = randomState.kind;
    if (!randomState.month) randomState.month = today.month() + 1;
    const monthSel = row.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": t("navigator.randomMonthPick") },
    });
    for (let m = 1; m <= 12; m++) {
      monthSel.createEl("option", {
        value: String(m),
        text: window.moment({ year: this.year, month: m - 1, day: 1 }).format("MMMM"),
      });
    }
    monthSel.value = String(randomState.month);
    const days = row.createEl("input", {
      type: "number",
      cls: "cwt-nav-random-days",
      attr: { min: "1", max: "36500", "aria-label": t("navigator.randomDays") },
    });
    days.value = String(randomState.days);
    const sync = () => {
      randomState.kind = kind.value as RandomKind;
      randomState.month = Number(monthSel.value);
      const n = Math.floor(Number(days.value));
      if (n >= 1 && n <= 36500) randomState.days = n;
      monthSel.toggle(randomState.kind === "month");
      days.toggle(randomState.kind === "lastDays");
    };
    [kind, monthSel, days].forEach((el) => el.addEventListener("change", sync));
    sync();

    const row2 = this.contentEl.createDiv("cwt-nav-random");
    const label = row2.createEl("label", { cls: "cwt-nav-random-skip" });
    const skip = label.createEl("input", { type: "checkbox" });
    skip.checked = randomState.skipEmpty;
    label.appendText(" " + t("navigator.randomSkipEmpty"));
    skip.addEventListener("change", () => (randomState.skipEmpty = skip.checked));
    const go = row2.createEl("button", { text: t("navigator.random") });
    setIcon(go.createSpan({ cls: "cwt-nav-random-icon", prepend: true }), "dice");
    go.addEventListener("click", () => {
      sync();
      const s = randomState;
      const scope: RandomScope =
        s.kind === "year"
          ? { kind: "year", year: this.year }
          : s.kind === "month"
            ? { kind: "month", year: this.year, month: s.month }
            : s.kind === "lastDays"
              ? { kind: "lastDays", days: s.days, today: today.format("YYYY-MM-DD") }
              : { kind: "all" };
      go.disabled = true;
      void this.deps.openRandom(scope, s.skipEmpty).then((opened) => {
        go.disabled = false;
        if (opened) this.close();
      });
    });
  }
}
