import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import { launch } from "src/ui/launch";

export interface IBatchItem {
  dateLabel: string;
  path: string;
  templateLabel: string;
}

/**
 * Confirmation before creating several notes: count, dates, templates.
 * Existing notes are never part of `items`; `existingCount` only informs.
 */
export class BatchCreateModal extends Modal {
  constructor(
    app: App,
    items: IBatchItem[],
    existingCount: number,
    onConfirm: () => Promise<void>,
    rangeLabel?: string,
  ) {
    super(app);
    this.titleEl.setText(t("batch.title"));
    const { contentEl } = this;
    contentEl.addClass("cwt-batch-modal");
    if (rangeLabel) contentEl.createEl("p", { cls: "cwt-batch-range", text: rangeLabel });
    contentEl.createEl("p", { text: t("batch.summary", { count: items.length }) });
    if (existingCount > 0) {
      contentEl.createEl("p", {
        cls: "setting-item-description",
        text: t("batch.existingSkipped", { count: existingCount }),
      });
    }
    const list = contentEl.createDiv("cwt-batch-list");
    for (const item of items) {
      const row = list.createDiv("cwt-batch-row");
      row.createSpan({ cls: "cwt-batch-date", text: item.dateLabel });
      row.createSpan({ cls: "cwt-batch-template", text: item.templateLabel });
      row.setAttr("title", item.path);
    }
    contentEl.createDiv("modal-button-container", (buttons) => {
      buttons
        .createEl("button", { text: t("batch.cancel") })
        .addEventListener("click", () => this.close());
      const ok = buttons.createEl("button", { cls: "mod-cta", text: t("batch.create") });
      ok.addEventListener(
        "click",
        () => {
          ok.disabled = true; // one run per dialog, even on double click
          this.close();
          launch(() => onConfirm());
        },
        { once: true },
      );
      window.setTimeout(() => ok.focus(), 0);
    });
  }
}
