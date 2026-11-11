import { Modal } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { MergeMode } from "src/core/merge";

import { ConfirmationModal } from "./confirm";
import { launch } from "src/ui/launch";

/**
 * Ask how to apply a template to a non-empty note. "Skip" (also Esc)
 * leaves the note untouched; "Replace" needs a second confirmation.
 */
export class ApplyTemplateModal extends Modal {
  constructor(
    app: App,
    private fileName: string,
    private description: string,
    private onChoose: (mode: MergeMode) => Promise<void>,
    private onSkip: () => void,
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
      add(t("apply.append"), "mod-cta", () => launch(() => this.choose("append")));
      add(t("apply.prepend"), "", () => launch(() => this.choose("prepend")));
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
      const skip = add(t("apply.skip"), "", () => {
        this.close();
        this.onSkip();
      });
      // Default focus on the harmless choice: Enter never changes the note.
      window.setTimeout(() => skip.focus(), 0);
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
