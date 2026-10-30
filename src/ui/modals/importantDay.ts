import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import { clampPrepDays, IMPORTANT_COLORS, MAX_PREP_DAYS } from "src/core/important";
import type { IImportantDay, ImportantColor } from "src/core/important";

/** "Mark as important…" dialog: title, color, preparation days, remove. */
export class ImportantDayModal extends Modal {
  private value: IImportantDay;

  constructor(
    app: App,
    private dateLabel: string,
    existing: IImportantDay | null,
    private onSave: (day: IImportantDay) => Promise<void>,
    private onRemove: (() => Promise<void>) | null,
  ) {
    super(app);
    this.value = existing ? { ...existing } : { title: "", color: "red", prepDays: 0 };
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText(`${t("important.title")}: ${this.dateLabel}`);
    contentEl.addClass("cwt-important-modal");

    new Setting(contentEl)
      .setName(t("important.name"))
      .setDesc(t("important.nameDesc"))
      .addText((text) => {
        text.setValue(this.value.title);
        text.onChange((v) => (this.value.title = v));
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    const colorSetting = new Setting(contentEl).setName(t("important.color"));
    const palette = colorSetting.controlEl.createDiv("cwt-palette");
    const swatches: HTMLElement[] = [];
    for (const color of IMPORTANT_COLORS) {
      const sw = palette.createEl("button", {
        cls: "cwt-swatch",
        attr: {
          "data-cwt-color": color,
          "aria-label": t(`color.${color}` as I18nKey),
          type: "button",
        },
      });
      if (color === this.value.color) {
        sw.addClass("is-selected");
      }
      sw.addEventListener("click", () => {
        this.value.color = color as ImportantColor;
        swatches.forEach((s) => s.removeClass("is-selected"));
        sw.addClass("is-selected");
      });
      swatches.push(sw);
    }

    new Setting(contentEl)
      .setName(t("important.prep"))
      .setDesc(t("important.prepDesc"))
      .addSlider((slider) => {
        slider
          .setLimits(0, MAX_PREP_DAYS, 1)
          .setValue(this.value.prepDays)
          .setDynamicTooltip()
          .onChange((v) => (this.value.prepDays = clampPrepDays(v)));
      });

    contentEl.createDiv("modal-button-container", (buttons) => {
      if (this.onRemove) {
        const rm = buttons.createEl("button", {
          cls: "mod-warning",
          text: t("important.remove"),
        });
        rm.addEventListener("click", async () => {
          this.close();
          await this.onRemove?.();
        });
      }
      buttons
        .createEl("button", { text: t("important.cancel") })
        .addEventListener("click", () => this.close());
      buttons
        .createEl("button", { cls: "mod-cta", text: t("important.save") })
        .addEventListener("click", async () => {
          this.close();
          await this.onSave({
            title: this.value.title.trim(),
            color: this.value.color,
            prepDays: clampPrepDays(this.value.prepDays),
          });
        });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
