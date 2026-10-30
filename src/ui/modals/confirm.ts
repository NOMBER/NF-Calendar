import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";

export interface IConfirmationDialogParams {
  cta: string;
  onAccept: () => Promise<void> | void;
  text: string;
  title: string;
  warning?: boolean;
}

export class ConfirmationModal extends Modal {
  constructor(app: App, config: IConfirmationDialogParams) {
    super(app);
    const { cta, onAccept, text, title, warning } = config;
    this.contentEl.createEl("h2", { text: title });
    this.contentEl.createEl("p", { text });
    this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
      buttonsEl
        .createEl("button", { text: t("confirm.cancel") })
        .addEventListener("click", () => this.close());
      buttonsEl
        .createEl("button", { cls: warning ? "mod-warning" : "mod-cta", text: cta })
        .addEventListener(
          "click",
          async () => {
            this.close();
            await onAccept();
          },
          { once: true },
        );
    });
  }
}
