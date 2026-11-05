import type { Moment } from "moment";
import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import { MAX_RANDOM_DAYS as MAX_DAYS, RANDOM_KINDS, scopeFromPrefs } from "src/core/random";
import type { DateFieldFormat } from "src/core/dateField";
import { createDateField } from "src/ui/dateField";
import type { IRandomPrefs, RandomKind, RandomScope } from "src/core/random";

export interface IDateNavigatorDeps {
  month: Moment;
  goToMonth: (month: Moment) => void;
  showStats: (month: Moment) => void;
  openDay: (date: Moment) => void;
  hasNote: (date: Moment) => boolean;
  /** Start values of the random-note controls (Settings → Random note). */
  randomDefaults: IRandomPrefs;
  /** Order/separator of typed date fields (Settings → Date field format). */
  dateFormat: DateFieldFormat;
  /** Resolves true when a note was opened. */
  openRandom: (scope: RandomScope, skipEmpty: boolean) => Promise<boolean>;
}

/** Values of the random-note controls while the window is open. */
interface IRandomState extends IRandomPrefs {
  month: number;
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
  private random: IRandomState;
  /** Random-note box expanded (kept across re-renders of this window). */
  private randomOpen = false;

  constructor(
    app: App,
    private deps: IDateNavigatorDeps,
  ) {
    super(app);
    this.year = deps.month.year();
    this.random = { ...deps.randomDefaults, month: deps.month.month() + 1 };
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
    // Random note: same row, right of "Open statistics"; its period right below.
    const go = modes.createEl("button", {
      cls: "cwt-nav-random-btn",
      attr: { "aria-expanded": String(this.randomOpen) },
    });
    setIcon(go.createSpan({ cls: "cwt-nav-random-icon" }), "dice");
    go.createSpan({ text: t("navigator.random") });
    setIcon(go.createSpan({ cls: "cwt-nav-random-chevron" }), "chevron-down");
    this.renderRandomOptions(go);

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
    const status = contentEl.createDiv("cwt-nav-status setting-item-description");
    const field = createDateField(dateRow, {
      value: today.format("YYYY-MM-DD"),
      format: this.deps.dateFormat,
      label: t("navigator.date"),
      onInput: () => updateStatus(),
    });
    const dateInput = field.inputEl;
    const parse = () => {
      const iso = field.getValue();
      if (!iso) return null;
      const d = window.moment(iso, "YYYY-MM-DD", true);
      return d.isValid() ? d : null;
    };
    const updateStatus = () => {
      const d = parse();
      status.setText(
        d ? t(this.deps.hasNote(d) ? "navigator.noteExists" : "navigator.noteNew") : "",
      );
    };
    dateInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") open.click();
    });
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

  /** Period for the random note (all / year / month / last N days / range) + skip empty. */
  private renderRandomOptions(go: HTMLButtonElement): void {
    const st = this.random;
    // Collapsible: "Open random note" only expands/collapses; "Open" inside runs it.
    const collapse = this.contentEl.createDiv("cwt-nav-random-collapse");
    collapse.toggleClass("is-open", this.randomOpen);
    const box = collapse.createDiv("cwt-nav-random");
    box.id = "cwt-nav-random-box";
    go.setAttr("aria-controls", box.id);
    const setOpen = (open: boolean) => {
      this.randomOpen = open;
      collapse.toggleClass("is-open", open);
      go.toggleClass("is-active", open);
      go.setAttr("aria-expanded", String(open));
      box.setAttr("inert", open ? null : "");
    };
    setOpen(this.randomOpen);
    go.addEventListener("click", () => setOpen(!this.randomOpen));
    const row = box.createDiv("cwt-nav-random-row");
    row.createSpan({ cls: "cwt-nav-random-label", text: t("navigator.randomScope") });
    const kind = row.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": t("navigator.randomScope") },
    });
    const labels: Record<RandomKind, string> = {
      all: t("navigator.randomAll"),
      year: t("navigator.randomYear", { year: String(this.year) }),
      month: t("navigator.randomMonth", { year: String(this.year) }),
      lastDays: t("navigator.randomLast"),
      range: t("navigator.randomRange"),
    };
    RANDOM_KINDS.forEach((k) => kind.createEl("option", { value: k, text: labels[k] }));
    kind.value = st.kind;

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
    monthSel.value = String(st.month);
    const days = row.createEl("input", {
      type: "number",
      cls: "cwt-nav-random-days",
      attr: { min: "1", max: String(MAX_DAYS), "aria-label": t("navigator.randomDays") },
    });
    days.value = String(st.days);
    const range = box.createDiv("cwt-nav-random-row");
    range.createSpan({ text: t("navigator.randomFrom") });
    const fmt = this.deps.dateFormat;
    const from = createDateField(range, {
      value: st.from,
      format: fmt,
      label: t("navigator.randomFrom"),
    });
    range.createSpan({ text: t("navigator.randomTo") });
    const to = createDateField(range, {
      value: st.to,
      format: fmt,
      label: t("navigator.randomTo"),
    });

    const label = box.createEl("label", { cls: "cwt-nav-random-skip" });
    const skip = label.createEl("input", { type: "checkbox" });
    skip.checked = st.skipEmpty;
    label.appendText(" " + t("navigator.randomSkipEmpty"));

    const sync = () => {
      st.kind = kind.value as RandomKind;
      st.month = Number(monthSel.value);
      const n = Math.floor(Number(days.value));
      if (n >= 1 && n <= MAX_DAYS) st.days = n;
      const f = from.getValue();
      const tv = to.getValue();
      if (f !== null) st.from = f;
      if (tv !== null) st.to = tv;
      st.skipEmpty = skip.checked;
      monthSel.toggle(st.kind === "month");
      days.toggle(st.kind === "lastDays");
      range.toggle(st.kind === "range");
    };
    [kind, monthSel, days, from.inputEl, to.inputEl, skip].forEach((el) =>
      el.addEventListener("change", sync),
    );
    sync();

    const actions = box.createDiv("cwt-nav-random-actions");
    const run = actions.createEl("button", { cls: "mod-cta", text: t("navigator.randomOpen") });
    run.addEventListener("click", () => {
      sync();
      if (from.getValue() === null || to.getValue() === null) {
        (from.getValue() === null ? from : to).inputEl.focus();
        return;
      }
      const today = window.moment();
      const scope: RandomScope = scopeFromPrefs(
        st,
        today.format("YYYY-MM-DD"),
        this.year,
        st.month,
      );
      run.disabled = true;
      void this.deps.openRandom(scope, st.skipEmpty).then((opened) => {
        run.disabled = false;
        if (opened) this.close();
      });
    });
  }
}
