import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import {
  clampPrepDays,
  emptyImportantDay,
  IMPORTANT_COLORS,
  isCustomColor,
  MAX_EVENTS_PER_DAY,
  MAX_PREP_DAYS,
  newEventId,
  sanitizeImportantColor,
} from "src/core/important";
import type { IImportantDay, IImportantEvent, ImportantColor } from "src/core/important";

/** "Mark as important…" dialog: shared colour/prep + one or more events. */
export class ImportantDayModal extends Modal {
  private value: IImportantDay;
  private focusNew = false;

  constructor(
    app: App,
    private dateLabel: string,
    existing: IImportantDay | null,
    private onSave: (day: IImportantDay) => Promise<void>,
    private onRemove: (() => Promise<void>) | null,
    /** When true, append an empty event and focus it (day already marked). */
    addEvent = false,
  ) {
    super(app);
    if (existing?.events?.length) {
      this.value = {
        color: existing.color,
        prepDays: existing.prepDays,
        events: existing.events.map((e) => ({ ...e })),
      };
      if (addEvent && this.value.events.length < MAX_EVENTS_PER_DAY) {
        this.value.events.push({ id: newEventId(), title: "" });
        this.focusNew = true;
      }
    } else {
      this.value = emptyImportantDay();
    }
  }

  onOpen(): void {
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(`${t("important.title")}: ${this.dateLabel}`);
    contentEl.addClass("cwt-important-modal");

    contentEl.createDiv({ cls: "setting-item-name", text: t("important.events") });
    const list = contentEl.createDiv("cwt-important-events");
    this.value.events.forEach((ev, index) => this.renderEventRow(list, ev, index));

    if (this.value.events.length < MAX_EVENTS_PER_DAY) {
      const add = contentEl.createEl("button", {
        cls: "cwt-small-button",
        text: t("important.addEvent"),
        attr: { type: "button" },
      });
      add.addEventListener("click", () => {
        this.value.events.push({ id: newEventId(), title: "" });
        this.focusNew = true;
        this.render();
      });
    }

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
        picker.removeClass("is-selected");
        sw.addClass("is-selected");
      });
      swatches.push(sw);
    }

    const picker = palette.createEl("input", {
      cls: "cwt-color-picker",
      attr: { type: "color", "aria-label": t("important.customColor") },
    });
    const custom = isCustomColor(this.value.color);
    picker.value = custom ? this.value.color : "#e93147";
    if (custom) {
      picker.addClass("is-selected");
    }
    picker.addEventListener("input", () => {
      if (!isCustomColor(picker.value)) {
        return;
      }
      this.value.color = sanitizeImportantColor(picker.value);
      swatches.forEach((s) => s.removeClass("is-selected"));
      picker.addClass("is-selected");
    });

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
          const events = this.value.events
            .map((e) => ({ id: e.id, title: e.title.trim() }))
            .filter((e) => e.title.length > 0 || this.value.events.length === 1);
          // Keep at least one event slot (possibly untitled) so the mark remains.
          const saved: IImportantDay = {
            color: this.value.color,
            prepDays: clampPrepDays(this.value.prepDays),
            events: events.length
              ? events.slice(0, MAX_EVENTS_PER_DAY)
              : [{ id: newEventId(), title: "" }],
          };
          this.close();
          await this.onSave(saved);
        });
    });
  }

  private renderEventRow(parent: HTMLElement, ev: IImportantEvent, index: number): void {
    const row = parent.createDiv("cwt-important-event-row");
    const input = row.createEl("input", {
      cls: "cwt-important-event-title",
      attr: {
        type: "text",
        placeholder: t("important.name"),
        "aria-label": t("important.name"),
      },
    });
    input.value = ev.title;
    input.addEventListener("input", () => {
      ev.title = input.value;
    });
    if (this.focusNew && index === this.value.events.length - 1) {
      window.setTimeout(() => input.focus(), 0);
      this.focusNew = false;
    } else if (!this.focusNew && index === 0 && this.value.events.length === 1) {
      window.setTimeout(() => input.focus(), 0);
    }
    if (this.value.events.length > 1) {
      const rm = row.createEl("button", {
        cls: "cwt-small-button",
        text: t("important.removeEvent"),
        attr: { type: "button" },
      });
      rm.addEventListener("click", () => {
        this.value.events.splice(index, 1);
        this.render();
      });
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
