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

function titleKey(layout: DailyFolderLayout): I18nKey {
  if (layout === "year-month") return "organize.titleYearMonth";
  if (layout === "flat") return "organize.titleFlat";
  return "organize.title";
}

function summaryKey(layout: DailyFolderLayout): I18nKey {
  if (layout === "year-month") return "organize.summaryYearMonth";
  if (layout === "flat") return "organize.summaryFlat";
  return "organize.summary";
}

function enableKey(layout: DailyFolderLayout): I18nKey {
  if (layout === "year-month") return "organize.enableYearMonth";
  if (layout === "flat") return "organize.enableFlat";
  return "organize.enable";
}

/** Preview → confirm → progress → report. Nothing moves before "Move". */
export class OrganizeModal extends Modal {
  private storeNew = true;
  private removeEmpty = true;

  constructor(
    app: App,
    private plan: IOrganizePlan,
    private folderLabel: string,
    private targetLayout: DailyFolderLayout,
    private run: (
      onProgress: (done: number, total: number) => void,
      opts: { removeEmpty: boolean },
    ) => Promise<IRunResult>,
    private currentLayout: DailyFolderLayout,
    private enableLayout: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl, plan } = this;
    this.titleEl.setText(t(titleKey(this.targetLayout)));
    contentEl.addClass("cwt-organize-modal");
    contentEl.createEl("p", {
      text: t(summaryKey(this.targetLayout), {
        count: plan.moves.length,
        folder: this.folderLabel,
      }),
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
    if (plan.emptyFolders.length) {
      list(
        contentEl,
        t("organize.emptyFolders", { count: plan.emptyFolders.length }),
        plan.emptyFolders,
      );
    }
    contentEl.createEl("p", { cls: "setting-item-description", text: t("organize.backup") });

    // Default ON: also switch where NEW notes are stored to match this organize.
    const storeLabel = contentEl.createEl("label", { cls: "cwt-organize-check" });
    const storeCb = storeLabel.createEl("input", { type: "checkbox" });
    storeCb.checked = this.storeNew;
    storeLabel.appendText(" " + t(enableKey(this.targetLayout)));
    storeCb.addEventListener("change", () => {
      this.storeNew = storeCb.checked;
    });

    if (plan.emptyFolders.length) {
      const emptyLabel = contentEl.createEl("label", { cls: "cwt-organize-check" });
      const emptyCb = emptyLabel.createEl("input", { type: "checkbox" });
      emptyCb.checked = this.removeEmpty;
      emptyLabel.appendText(" " + t("organize.removeEmpty"));
      emptyCb.addEventListener("change", () => {
        this.removeEmpty = emptyCb.checked;
      });
    } else {
      this.removeEmpty = false;
    }

    contentEl.createDiv("modal-button-container", (buttons) => {
      buttons
        .createEl("button", { text: t("batch.cancel") })
        .addEventListener("click", () => this.close());
      if (!plan.moves.length) {
        // Still allow applying storage layout alone when already organized.
        if (this.currentLayout !== this.targetLayout) {
          const en = buttons.createEl("button", {
            cls: "mod-cta",
            text: t(enableKey(this.targetLayout)),
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
        return;
      }
      const ok = buttons.createEl("button", { cls: "mod-cta", text: t("organize.move") });
      ok.addEventListener("click", () => void this.execute(buttons), { once: true });
    });
  }

  private async execute(buttons: HTMLElement): Promise<void> {
    buttons.empty();
    const progress = this.contentEl.createEl("p", { cls: "cwt-organize-progress" });
    const result = await this.run(
      (done, total) => progress.setText(t("organize.progress", { done, total })),
      { removeEmpty: this.removeEmpty },
    );
    if (this.storeNew && result.done.length) {
      await this.enableLayout();
    }
    this.report(result);
  }

  private report(result: IRunResult): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(t("organize.doneTitle"));
    contentEl.createEl("p", {
      text: t("organize.done", { moved: result.done.length, failed: result.failed.length }),
    });
    if (result.removedFolders?.length) {
      contentEl.createEl("p", {
        text: t("organize.removedFolders", { count: result.removedFolders.length }),
      });
      list(contentEl, t("organize.removedFoldersList"), result.removedFolders);
    }
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
    if (this.storeNew && result.done.length) {
      const key =
        this.targetLayout === "flat"
          ? "organize.enabledFlat"
          : this.targetLayout === "year-month"
            ? "organize.enabledYearMonth"
            : "organize.enabledYear";
      contentEl.createEl("p", {
        cls: "setting-item-description",
        text: t(key),
      });
    }
    contentEl.createDiv("modal-button-container", (buttons) => {
      buttons
        .createEl("button", { text: t("organize.close") })
        .addEventListener("click", () => this.close());
    });
  }
}
