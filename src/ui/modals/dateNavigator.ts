import type { Moment } from "moment";
import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import { MAX_RANDOM_DAYS as MAX_DAYS, RANDOM_KINDS, scopeFromPrefs } from "src/core/random";
import type { DateFieldFormat } from "src/core/dateField";
import { createDateField } from "src/ui/dateField";
import type { IRandomPrefs, RandomKind, RandomScope } from "src/core/random";
import type { IStatsPanelDeps } from "src/ui/modals/statsPanel";
import { StatsPanel } from "src/ui/modals/statsPanel";

export interface IDateNavigatorDeps {
  month: Moment;
  goToMonth: (month: Moment) => void;
  openDay: (date: Moment) => void;
  hasNote: (date: Moment) => boolean;
  /** Start values of the random-note controls (Settings → Random note). */
  randomDefaults: IRandomPrefs;
  /** Order/separator of typed date fields (Settings → Date field format). */
  dateFormat: DateFieldFormat;
  /** Resolves true when a note was opened. */
  openRandom: (scope: RandomScope, skipEmpty: boolean) => Promise<boolean>;
  /** Same deps as the standalone Stats modal — embedded in-place. */
  stats: IStatsPanelDeps;
}

/** Values of the random-note controls while the window is open. */
interface IRandomState extends IRandomPrefs {
  month: number;
}

type Screen = "goto" | "stats";

/**
 * Quick navigation opened by a click on the "Month Year" title.
 * "Open statistics" swaps this modal's content to the stats panel (no second
 * modal); Back restores the Go-to-date UI with state preserved.
 */
export class DateNavigatorModal extends Modal {
  private year: number;
  private yearGrid = false;
  private random: IRandomState;
  /** Random-note box expanded (kept across re-renders of this window). */
  private randomOpen = false;
  private screen: Screen = "goto";
  private statsPanel: StatsPanel | null = null;
  /** Month shown when the stats screen was last opened (Back preserves goto). */
  private statsMonth: Moment;

  constructor(
    app: App,
    private deps: IDateNavigatorDeps,
  ) {
    super(app);
    this.year = deps.month.year();
    this.random = { ...deps.randomDefaults, month: deps.month.month() + 1 };
    this.statsMonth = deps.month.clone().startOf("month");
  }

  onOpen(): void {
    this.modalEl.addClass("cwt-nav-modal");
    this.render();
  }

  onClose(): void {
    this.statsPanel?.destroy();
    this.statsPanel = null;
    this.contentEl.empty();
  }

  private render(): void {
    if (this.screen === "stats") {
      this.renderStats();
      return;
    }
    this.renderGoto();
  }

  /** In-place statistics (replaces Go-to-date content; Back restores it). */
  private renderStats(): void {
    this.statsPanel?.destroy();
    this.statsPanel = null;
    this.contentEl.empty();
    this.titleEl.setText(t("stats.title"));
    this.modalEl.addClass("cwt-stats-modal");
    this.statsPanel = new StatsPanel(
      this.app,
      this.contentEl,
      {
        ...this.deps.stats,
        openDay: (date) => {
          this.close();
          this.deps.stats.openDay(date);
        },
      },
      this.statsMonth,
      {
        header: (bar) => {
          const back = bar.createEl("button", {
            cls: "cwt-nav-back",
            text: t("navigator.back"),
            attr: { "aria-label": t("navigator.back") },
          });
          back.addEventListener("click", () => {
            this.statsMonth = this.statsPanel?.getMonth() ?? this.statsMonth;
            this.statsPanel?.destroy();
            this.statsPanel = null;
            this.screen = "goto";
            this.modalEl.removeClass("cwt-stats-modal");
            this.render();
          });
        },
      },
    );
    void this.statsPanel.render();
  }

  private renderGoto(): void {
    this.statsPanel?.destroy();
    this.statsPanel = null;
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(t("navigator.title"));
    this.modalEl.removeClass("cwt-stats-modal");

    // Mode row: Open in calendar (noop / current), Open statistics (swap), Random.
    const modes = contentEl.createDiv("cwt-nav-modes");
    const cal = modes.createEl("button", {
      cls: "cwt-nav-mode is-active",
      text: t("navigator.toCalendar"),
      attr: { "aria-pressed": "true" },
    });
    // Calendar mode is the default goto screen; clicking keeps us here.
    cal.addEventListener("click", () => {
      /* already on goto */
    });

    const statsBtn = modes.createEl("button", {
      cls: "cwt-nav-mode cwt-nav-open-stats",
      text: t("navigator.toStats"),
      attr: { "aria-pressed": "false", type: "button" },
    });
    statsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openStatsScreen();
    });

    const go = modes.createEl("button", {
      cls: "cwt-nav-random-btn",
      attr: { "aria-expanded": String(this.randomOpen), type: "button" },
    });
    setIcon(go.createSpan({ cls: "cwt-nav-random-icon" }), "dice");
    go.createSpan({ text: t("navigator.random") });
    setIcon(go.createSpan({ cls: "cwt-nav-random-chevron" }), "chevron-down");
    this.renderRandomOptions(go);

    // Year row.
    const yearRow = contentEl.createDiv("cwt-nav-year");
    const prev = yearRow.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("navigator.prevYear"), type: "button" },
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
      attr: { "aria-label": t("navigator.yearGrid"), type: "button" },
    });
    setIcon(gridBtn, "layout-grid");
    const next = yearRow.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-label": t("navigator.nextYear"), type: "button" },
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
        const b = grid.createEl("button", {
          cls: "cwt-nav-cell",
          text: String(y),
          attr: { type: "button" },
        });
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
        const b = grid.createEl("button", {
          cls: "cwt-nav-cell",
          text: month.format("MMM"),
          attr: { type: "button" },
        });
        b.toggleClass("is-current", month.isSame(today, "month"));
        b.toggleClass("is-active", month.isSame(this.deps.month, "month"));
        b.addEventListener("click", () => {
          this.close();
          this.deps.goToMonth(month.clone());
        });
      }
    }

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
    const open = dateRow.createEl("button", {
      cls: "mod-cta",
      text: t("navigator.openDay"),
      attr: { type: "button" },
    });
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
    const todayBtn = dateRow.createEl("button", {
      text: t("navigator.today"),
      attr: { type: "button" },
    });
    todayBtn.addEventListener("click", () => {
      this.close();
      this.deps.goToMonth(window.moment().startOf("month"));
    });
  }

  /** Switch content to statistics (same modal; no close/reopen). */
  openStatsScreen(month?: Moment): void {
    if (month) this.statsMonth = month.clone().startOf("month");
    else this.statsMonth = window.moment({ year: this.year, month: this.random.month - 1, day: 1 });
    // Prefer the calendar's displayed month when opening from the title.
    if (!month) this.statsMonth = this.deps.month.clone().startOf("month");
    this.screen = "stats";
    this.render();
  }

  /** Period for the random note + skip empty. */
  private renderRandomOptions(go: HTMLButtonElement): void {
    const st = this.random;
    // Collapsible lives BELOW the mode row (sibling), never overlaid on buttons.
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
      // Closed collapse must not intercept clicks on the mode buttons above.
      collapse.style.pointerEvents = open ? "" : "none";
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
    const run = actions.createEl("button", {
      cls: "mod-cta",
      text: t("navigator.randomOpen"),
      attr: { type: "button" },
    });
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
