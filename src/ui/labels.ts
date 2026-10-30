/** Localised labels shared by menus, modals and the settings tab. */
import type { Granularity } from "src/core/dates";
import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import { WEEKDAY_KEYS } from "src/core/rules";
import type { ITemplateCandidate, WeekdayKey } from "src/core/rules";

export function typeLabel(g: Granularity): string {
  return t(`type.${g}` as I18nKey);
}

/** Human readable reason, e.g. `special rule "Holiday"`. */
export function describeCandidate(c: ITemplateCandidate | null): string {
  if (!c) {
    return t("source.none");
  }
  if (c.source === "rule") {
    return t("source.rule", { name: c.ruleName || "?" });
  }
  if (c.source === "weekday") {
    const idx = WEEKDAY_KEYS.indexOf(c.weekday as WeekdayKey);
    return t("source.weekday", { weekday: idx >= 0 ? window.moment.weekdays(idx) : c.weekday });
  }
  return t("source.default");
}
