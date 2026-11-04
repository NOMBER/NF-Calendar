import type { Moment } from "moment";
import type { App } from "obsidian";

import { t } from "src/core/i18n";
import { getDayMarks } from "src/core/important";
import { firstLines } from "src/core/placeholders";
import type { ISettings } from "src/core/settings";
import { holidayAge } from "src/core/holidays";
import { holidaysFor } from "src/io/holidays";
import { chooseTemplateFor, resolveTemplateFile } from "src/io/notes";
import { describeCandidate } from "./labels";

export const PREVIEW_DELAY_MS = 400;
const PREVIEW_LINES = 10;

/**
 * Tooltip shown when hovering an EMPTY day: which template will be used,
 * why, and its first lines (raw, without substitutions). For days that
 * already have a note it only lists the day's holidays (`holidaysOnly`).
 */
export class TemplatePreview {
  private timer: number | null = null;
  private el: HTMLElement | null = null;
  private pendingKey: string | null = null;
  private target: HTMLElement | null = null;

  constructor(
    private app: App,
    private getSettings: () => ISettings,
  ) {
    this.hide = this.hide.bind(this);
  }

  schedule(date: Moment, targetEl: EventTarget, holidaysOnly = false): void {
    const dayEl =
      ((targetEl as HTMLElement)?.closest?.(".day") as HTMLElement) || (targetEl as HTMLElement);
    if (!dayEl) {
      return;
    }
    const key = `${date.format("YYYY-MM-DD")}${holidaysOnly ? "h" : ""}`;
    if (this.pendingKey === key && this.target === dayEl) {
      return;
    }
    this.hide();
    this.pendingKey = key;
    this.target = dayEl;
    dayEl.addEventListener("pointerleave", this.hide, { once: true });
    dayEl.addEventListener("pointerdown", this.hide, { once: true });
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.show(date.clone(), dayEl, key, holidaysOnly);
    }, PREVIEW_DELAY_MS);
  }

  hide(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    // Remove the `once` listeners too, they stay attached if never fired.
    this.target?.removeEventListener("pointerleave", this.hide);
    this.target?.removeEventListener("pointerdown", this.hide);
    this.el?.remove();
    this.el = null;
    this.pendingKey = null;
    this.target = null;
  }

  private async show(
    date: Moment,
    anchor: HTMLElement,
    key: string,
    holidaysOnly: boolean,
  ): Promise<void> {
    const settings = this.getSettings();
    const app = this.app;
    const resolution = holidaysOnly
      ? { chosen: null, missing: [] }
      : chooseTemplateFor(app, date, settings, "day");
    let lines: string[] = [];
    let truncated = false;
    if (resolution.chosen) {
      const file = resolveTemplateFile(app, resolution.chosen.path);
      if (file) {
        ({ lines, truncated } = firstLines(await app.vault.cachedRead(file), PREVIEW_LINES));
      }
    }
    if (this.pendingKey !== key || !anchor.isConnected) {
      return; // pointer moved on while reading
    }

    const el = document.body.createDiv("cwt-template-preview");
    el.createDiv({
      cls: "cwt-preview-title",
      text: t("preview.title", { date: date.format("dddd, LL") }),
    });
    const marks = getDayMarks(window.moment, date, settings.importantDays);
    if (marks.important) {
      el.createDiv({
        cls: "cwt-preview-important",
        text: t("preview.important", { title: marks.important.title || t("important.untitled") }),
      }).setAttr("data-cwt-color", marks.important.color);
    } else if (marks.preparingFor.length) {
      const p = marks.preparingFor[0];
      el.createDiv({
        cls: "cwt-preview-important",
        text: t("preview.prepare", {
          title: p.day.title || t("important.untitled"),
          days: p.daysLeft,
        }),
      }).setAttr("data-cwt-color", p.day.color);
    }
    const holidays = holidaysFor(date);
    if (holidays.length) {
      const list = el.createDiv("cwt-preview-holidays");
      for (const h of holidays) {
        const age = holidayAge(h, date);
        list.createDiv({
          cls: "cwt-preview-holiday",
          text: `🎉 ${h.name}${age !== null ? ` (${t("holiday.age", { age })})` : ""}`,
        });
      }
    }
    if (holidaysOnly) {
      this.place(el, anchor);
      return;
    }
    if (resolution.chosen) {
      el.createDiv({
        cls: "cwt-preview-meta",
        text: t("preview.template", { path: resolution.chosen.path }),
      });
    }
    el.createDiv({
      cls: "cwt-preview-meta",
      text: t("preview.reason", { reason: describeCandidate(resolution.chosen) }),
    });
    if (resolution.missing.length) {
      el.createDiv({
        cls: "cwt-preview-meta cwt-preview-warning",
        text: t("source.missing", { paths: resolution.missing.map((m) => m.path).join(", ") }),
      });
    }
    if (resolution.chosen) {
      const pre = el.createEl("pre", { cls: "cwt-preview-body" });
      pre.setText(lines.join("\n") + (truncated ? `\n${t("preview.more")}` : ""));
    } else {
      el.createDiv({ cls: "cwt-preview-meta", text: t("preview.empty") });
    }

    this.place(el, anchor);
  }

  private place(el: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - box.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - box.width - 8));
    let top = rect.bottom + 6;
    if (top + box.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - box.height - 6);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    this.el = el;
  }
}
