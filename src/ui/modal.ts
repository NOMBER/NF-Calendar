import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/i18n";

interface IConfirmationDialogParams {
  cta: string;
  // eslint-disable-next-line
  onAccept: (...args: any[]) => Promise<void>;
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
        .addEventListener("click", async (e) => {
          this.close();
          await onAccept(e);
        });
    });
  }
}

export function createConfirmationDialog(params: IConfirmationDialogParams): void {
  new ConfirmationModal(window.app, params).open();
}
