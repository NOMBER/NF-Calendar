import { Modal } from "obsidian";
import type { App } from "obsidian";

import type { MergeMode } from "src/core/merge";
import { t } from "src/i18n";

import { ConfirmationModal } from "./modal";

/** Ask how to apply a template to a non-empty note. */
export class ApplyTemplateModal extends Modal {
  constructor(
    app: App,
    private fileName: string,
    private description: string,
    private onChoose: (mode: MergeMode) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t("apply.title", { file: this.fileName }));
    this.contentEl.createEl("p", { text: this.description });
    this.contentEl.createDiv("modal-button-container cwt-apply-buttons", (buttons) => {
      const add = (text: string, cls: string, fn: () => void) => {
        const b = buttons.createEl("button", { text, cls });
        b.addEventListener("click", fn);
        return b;
      };
      add(t("apply.append"), "mod-cta", () => this.choose("append"));
      add(t("apply.prepend"), "", () => this.choose("prepend"));
      add(t("apply.replace"), "mod-warning", () => {
        this.close();
        new ConfirmationModal(this.app, {
          title: t("apply.confirmReplaceTitle"),
          text: t("apply.confirmReplaceText", { file: this.fileName }),
          cta: t("apply.replace"),
          warning: true,
          onAccept: () => this.onChoose("replace"),
        }).open();
      });
      add(t("apply.cancel"), "", () => this.close());
    });
  }

  private async choose(mode: MergeMode): Promise<void> {
    this.close();
    await this.onChoose(mode);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
