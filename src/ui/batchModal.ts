import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/i18n";

export interface IBatchItem {
  dateLabel: string;
  path: string;
  templateLabel: string;
}

/** Confirmation before creating several notes: count, dates, templates. */
export class BatchCreateModal extends Modal {
  constructor(app: App, items: IBatchItem[], onConfirm: () => Promise<void>) {
    super(app);
    this.titleEl.setText(t("batch.title"));
    const { contentEl } = this;
    contentEl.addClass("cwt-batch-modal");
    contentEl.createEl("p", { text: t("batch.summary", { count: items.length }) });
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
      ok.addEventListener("click", async () => {
        this.close();
        await onConfirm();
      });
      window.setTimeout(() => ok.focus(), 0);
    });
  }
}
