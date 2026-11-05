import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import type { DailyFolderLayout, IMove, IOrganizePlan, SkipReason } from "src/core/organize";
import type { IRunResult } from "src/io/organize";

const SAMPLE = 30;

function list(parent: HTMLElement, summary: string, rows: string[]): void {
  if (!rows.length) {
    return;
  }
  const d = parent.createEl("details", { cls: "cwt-organize-list" });
  d.createEl("summary", { text: summary });
  for (const r of rows.slice(0, SAMPLE)) {
    d.createDiv({ cls: "cwt-organize-row", text: r });
  }
  if (rows.length > SAMPLE) {
    d.createDiv({ cls: "cwt-muted", text: t("organize.more", { count: rows.length - SAMPLE }) });
  }
}

/** Preview → confirm → progress → report. Nothing moves before "Move". */
export class OrganizeModal extends Modal {
  constructor(
    app: App,
    private plan: IOrganizePlan,
    private folderLabel: string,
    private targetLayout: "year" | "year-month",
    private run: (onProgress: (done: number, total: number) => void) => Promise<IRunResult>,
    private currentLayout: DailyFolderLayout,
    private enableLayout: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, plan } = this;
    this.titleEl.setText(
      t(this.targetLayout === "year-month" ? "organize.titleYearMonth" : "organize.title"),
    );
    contentEl.addClass("cwt-organize-modal");
    contentEl.createEl("p", {
      text: t(
        this.targetLayout === "year-month" ? "organize.summaryYearMonth" : "organize.summary",
        { count: plan.moves.length, folder: this.folderLabel },
      ),
    });
    const years = Object.keys(plan.byYear).sort();
    if (years.length) {
      const ul = contentEl.createEl("ul");
      for (const y of years) {
        ul.createEl("li", { text: `${y}/ — ${plan.byYear[y]}` });
      }
    }
    const reasons: SkipReason[] = [
      "unparsed",
      "conflict",
      "inSubfolder",
      "formatHasFolders",
      "already",
    ];
    for (const reason of reasons) {
      const rows = plan.skipped.filter((s) => s.reason === reason).map((s) => s.path);
      list(contentEl, t(`organize.skip.${reason}` as I18nKey, { count: rows.length }), rows);
    }
    contentEl.createEl("p", { cls: "setting-item-description", text: t("organize.backup") });

    contentEl.createDiv("modal-button-container", (buttons) => {
      buttons
        .createEl("button", { text: t("batch.cancel") })
        .addEventListener("click", () => this.close());
      if (!plan.moves.length) {
        return;
      }
      const ok = buttons.createEl("button", { cls: "mod-cta", text: t("organize.move") });
      ok.addEventListener("click", () => void this.execute(buttons), { once: true });
    });
  }

  private async execute(buttons: HTMLElement): Promise<void> {
    buttons.empty();
    const progress = this.contentEl.createEl("p", { cls: "cwt-organize-progress" });
    const result = await this.run((done, total) =>
      progress.setText(t("organize.progress", { done, total })),
    );
    this.report(result);
  }

  private report(result: IRunResult): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(t("organize.doneTitle"));
    contentEl.createEl("p", {
      text: t("organize.done", { moved: result.done.length, failed: result.failed.length }),
    });
    const fmt = (m: IMove) => `${m.from} → ${m.to}`;
    list(contentEl, t("organize.movedList", { count: result.done.length }), result.done.map(fmt));
    list(
      contentEl,
      t("organize.failedList", { count: result.failed.length }),
      result.failed.map((f) => `${fmt(f.move)} (${f.error})`),
    );
    if (result.done.length) {
      contentEl.createEl("p", { cls: "setting-item-description", text: t("organize.undoHint") });
    }
    contentEl.createDiv("modal-button-container", (buttons) => {
      const layoutMatches = this.currentLayout === this.targetLayout;
      if (!layoutMatches && result.done.length) {
        const en = buttons.createEl("button", {
          cls: "mod-cta",
          text: t(
            this.targetLayout === "year-month" ? "organize.enableYearMonth" : "organize.enable",
          ),
        });
        en.addEventListener(
          "click",
          async () => {
            await this.enableLayout();
            this.close();
          },
          { once: true },
        );
      }
      buttons
        .createEl("button", { text: t("organize.close") })
        .addEventListener("click", () => this.close());
    });
  }
}
