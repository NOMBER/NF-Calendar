import { Notice, PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { DEFAULT_WORDS_PER_DOT } from "src/constants";
import type { Granularity } from "src/core/dates";
import {
  defaultCondition,
  EMPTY_WEEKDAY_TEMPLATES,
  isConditionValid,
  newRuleId,
  orderedWeekdays,
  RULE_CONDITION_TYPES,
  WEEKDAY_KEYS,
} from "src/core/rules";
import type { ITemplateRule, RuleCondition, RuleConditionType } from "src/core/rules";
import { t } from "src/i18n";
import type { I18nKey } from "src/i18n";
import { readExternalPeriodicSettings } from "src/io/external";
import { resolveTemplateFile, typeLabel } from "src/io/notes";
import { mergeExternal } from "src/settingsData";
import type { IPeriodicConfig, ISettings, Language } from "src/settingsData";
import { FileSuggest } from "src/ui/fileSuggest";

import type CalendarPlugin from "./main";

export type { ISettings } from "./settingsData";
export { defaultSettings } from "./settingsData";

const WEEK_START_KEYS = WEEKDAY_KEYS; // sunday..saturday, same as calendar-ui

export class CalendarSettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: CalendarPlugin) {
    super(app, plugin);
  }

  private get options(): ISettings {
    return this.plugin.options;
  }

  private write(fn: (s: ISettings) => Partial<ISettings>): Promise<void> {
    return this.plugin.writeOptions(fn);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("cwt-settings");

    this.heading(t("settings.general"));
    this.addLanguage();
    this.addWordsPerDot();
    this.addWeekStart();
    this.addConfirm();
    this.addPreview();
    this.addUpcoming();

    this.addPeriodicSection("day");
    this.addPeriodicSection("week");
    this.addPeriodicSection("month");
    this.addImport();

    this.heading(t("settings.weekdayTemplates"));
    this.addWeekdayTemplates();

    this.heading(t("settings.rules"));
    this.addRules();

    this.heading(t("settings.advanced"));
    this.addLocaleOverride();
  }

  private heading(text: string): void {
    new Setting(this.containerEl).setName(text).setHeading();
  }

  // ---------- general ----------

  private addLanguage(): void {
    new Setting(this.containerEl)
      .setName(t("settings.language"))
      .setDesc(t("settings.languageDesc"))
      .addDropdown((d) => {
        d.addOption("auto", t("settings.langAuto"));
        d.addOption("en", "English");
        d.addOption("ru", "Русский");
        d.setValue(this.options.language);
        d.onChange(async (v) => {
          await this.write(() => ({ language: v as Language }));
          this.plugin.getView()?.refresh();
          this.display();
        });
      });
  }

  private addWordsPerDot(): void {
    new Setting(this.containerEl)
      .setName(t("settings.wordsPerDot"))
      .setDesc(t("settings.wordsPerDotDesc"))
      .addText((text) => {
        text.inputEl.type = "number";
        text.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        text.setValue(String(this.options.wordsPerDot ?? ""));
        text.onChange(async (v) => {
          const n = Number(v);
          await this.write(() => ({
            wordsPerDot: v !== "" && n > 0 ? n : DEFAULT_WORDS_PER_DOT,
          }));
        });
      });
  }

  private addWeekStart(): void {
    const { moment } = window;
    const names = moment.weekdays();
    const localeDow = window._bundledLocaleWeekSpec?.dow ?? moment.localeData().firstDayOfWeek();
    new Setting(this.containerEl)
      .setName(t("settings.weekStart"))
      .setDesc(t("settings.weekStartDesc"))
      .addDropdown((d) => {
        d.addOption("locale", t("settings.localeDefault", { day: names[localeDow] }));
        names.forEach((day, i) => d.addOption(WEEK_START_KEYS[i], day));
        d.setValue(this.options.weekStart);
        d.onChange(async (v) => {
          await this.write(() => ({ weekStart: v as IWeekStartOption }));
          this.display(); // weekday order below depends on it
        });
      });
  }

  private addConfirm(): void {
    this.toggle(t("settings.confirm"), t("settings.confirmDesc"), "shouldConfirmBeforeCreate");
  }

  private addPreview(): void {
    this.toggle(t("settings.preview"), t("settings.previewDesc"), "showTemplatePreview");
  }

  private addUpcoming(): void {
    this.toggle(t("settings.upcoming"), t("settings.upcomingDesc"), "showUpcoming");
    new Setting(this.containerEl)
      .setName(t("settings.horizon"))
      .setDesc(t("settings.horizonDesc"))
      .addSlider((s) =>
        s
          .setLimits(7, 365, 1)
          .setValue(this.options.upcomingHorizonDays)
          .setDynamicTooltip()
          .onChange(async (v) => {
            await this.write(() => ({ upcomingHorizonDays: v }));
          })
      );
  }

  private toggle(
    name: string,
    desc: string,
    key: "shouldConfirmBeforeCreate" | "showTemplatePreview" | "showUpcoming" | "useWeekdayTemplates",
    rerender = false
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((tg) => {
        tg.setValue(!!this.options[key]);
        tg.onChange(async (v) => {
          await this.write(() => ({ [key]: v } as Partial<ISettings>));
          if (rerender) {
            this.display();
          }
        });
      });
  }

  // ---------- daily / weekly / monthly ----------

  private configKey(g: Granularity): "daily" | "weekly" | "monthly" {
    return g === "day" ? "daily" : g === "week" ? "weekly" : "monthly";
  }

  private async writePeriodic(g: Granularity, patch: Partial<IPeriodicConfig>): Promise<void> {
    const key = this.configKey(g);
    await this.write((old) => ({ [key]: { ...old[key], ...patch } } as Partial<ISettings>));
    this.plugin.reindexAll();
  }

  private addPeriodicSection(g: Granularity): void {
    const key = this.configKey(g);
    const cfg = this.options[key];
    this.heading(t(`settings.${key}` as I18nKey));

    new Setting(this.containerEl)
      .setName(t("settings.enabled"))
      .setDesc(t(`settings.${key}EnabledDesc` as I18nKey))
      .addToggle((tg) => {
        tg.setValue(cfg.enabled);
        tg.onChange(async (v) => {
          await this.writePeriodic(g, { enabled: v });
          this.display();
        });
      });
    if (!cfg.enabled) {
      return;
    }

    new Setting(this.containerEl)
      .setName(t("settings.folder"))
      .setDesc(t("settings.folderDesc"))
      .addText((text) => {
        text.setPlaceholder("/");
        text.setValue(cfg.folder);
        text.onChange((v) => this.writePeriodic(g, { folder: v.trim() }));
      });

    const formatSetting = new Setting(this.containerEl).setName(t("settings.format"));
    const updateSample = (format: string) =>
      formatSetting.setDesc(
        t("settings.formatDesc", { sample: window.moment().format(format || "YYYY-MM-DD") })
      );
    updateSample(cfg.format);
    formatSetting.addText((text) => {
      text.setValue(cfg.format);
      text.onChange(async (v) => {
        updateSample(v.trim());
        if (v.trim()) {
          await this.writePeriodic(g, { format: v.trim() });
        }
      });
    });

    const tplSetting = new Setting(this.containerEl).setName(t("settings.template"));
    const baseDesc = t("settings.templateDesc");
    tplSetting.setDesc(baseDesc);
    tplSetting.addSearch((search) => {
      new FileSuggest(this.app, search.inputEl);
      search.setPlaceholder("Templates/…");
      search.setValue(cfg.template);
      search.onChange(async (v) => {
        await this.writePeriodic(g, { template: v.trim() });
        this.validateTemplate(tplSetting, v, baseDesc);
      });
      this.validateTemplate(tplSetting, cfg.template, baseDesc);
    });
  }

  private addImport(): void {
    new Setting(this.containerEl)
      .setName(t("settings.import"))
      .setDesc(t("settings.importDesc"))
      .addButton((b) =>
        b.setButtonText(t("settings.importButton")).onClick(async () => {
          const ext = readExternalPeriodicSettings(this.app);
          const found: string[] = [];
          await this.write((old) => {
            const patch: Partial<ISettings> = {};
            if (ext.daily) {
              patch.daily = mergeExternal(old.daily, ext.daily, "day");
              found.push(typeLabel("day"));
            }
            if (ext.weekly) {
              patch.weekly = mergeExternal(old.weekly, ext.weekly, "week");
              found.push(typeLabel("week"));
            }
            if (ext.monthly) {
              patch.monthly = mergeExternal(old.monthly, ext.monthly, "month");
              found.push(typeLabel("month"));
            }
            return patch;
          });
          new Notice(
            found.length ? t("notice.importDone", { what: found.join(", ") }) : t("notice.importNothing")
          );
          this.plugin.reindexAll();
          this.display();
        })
      );
  }

  // ---------- weekday templates ----------

  private addWeekdayTemplates(): void {
    this.toggle(t("settings.useWeekday"), t("settings.useWeekdayDesc"), "useWeekdayTemplates", true);
    if (!this.options.useWeekdayTemplates) {
      return;
    }
    const { moment } = window;
    const weekStart = this.options.weekStart;
    const firstDay =
      weekStart && weekStart !== "locale"
        ? WEEK_START_KEYS.indexOf(weekStart as typeof WEEK_START_KEYS[number])
        : window._bundledLocaleWeekSpec?.dow ?? moment.localeData().firstDayOfWeek();
    const names = moment.weekdays();
    const desc = t("settings.weekdayTemplateDesc");
    for (const day of orderedWeekdays(firstDay < 0 ? 1 : firstDay)) {
      const name = names[WEEKDAY_KEYS.indexOf(day)];
      const setting = new Setting(this.containerEl)
        .setName(t("settings.weekdayTemplate", { weekday: name }))
        .setDesc(desc);
      setting.addSearch((search) => {
        new FileSuggest(this.app, search.inputEl);
        search.setPlaceholder(`Templates/${name}`);
        search.setValue(this.options.weekdayTemplates?.[day] || "");
        search.onChange(async (v) => {
          await this.write((old) => ({
            weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES, ...(old.weekdayTemplates || {}), [day]: v.trim() },
          }));
          this.validateTemplate(setting, v, desc);
        });
        this.validateTemplate(setting, search.getValue(), desc);
      });
    }
  }

  private validateTemplate(setting: Setting, value: string, desc: string): void {
    const path = (value || "").trim();
    const missing = !!path && !resolveTemplateFile(this.app, path);
    setting.setDesc(missing ? t("settings.fileMissing") : desc);
    setting.descEl.toggleClass("cwt-template-missing", missing);
  }

  // ---------- special rules ----------

  private async writeRules(fn: (rules: ITemplateRule[]) => ITemplateRule[], rerender = false): Promise<void> {
    await this.write((old) => ({ templateRules: fn(old.templateRules.map((r) => ({ ...r }))) }));
    if (rerender) {
      this.display();
    }
  }

  private updateRule(id: string, patch: Partial<ITemplateRule>, rerender = false): Promise<void> {
    return this.writeRules((rules) => rules.map((r) => (r.id === id ? { ...r, ...patch } : r)), rerender);
  }

  private addRules(): void {
    this.containerEl.createEl("p", { cls: "setting-item-description", text: t("settings.rulesDesc") });
    const rules = this.options.templateRules;
    rules.forEach((rule, index) => this.renderRule(rule, index, rules.length));
    new Setting(this.containerEl).addButton((b) =>
      b
        .setButtonText(t("settings.addRule"))
        .setCta()
        .onClick(() =>
          this.writeRules(
            (rs) => [
              ...rs,
              {
                id: newRuleId(),
                name: "",
                enabled: true,
                condition: defaultCondition("annual"),
                template: "",
                appliesTo: ["day"],
              },
            ],
            true
          )
        )
    );
  }

  private renderRule(rule: ITemplateRule, index: number, count: number): void {
    const box = this.containerEl.createDiv("cwt-rule");
    if (!rule.enabled) {
      box.addClass("is-disabled");
    }

    new Setting(box)
      .setName(`${index + 1}.`)
      .addText((text) => {
        text.setPlaceholder(t("settings.ruleName"));
        text.setValue(rule.name);
        text.onChange((v) => this.updateRule(rule.id, { name: v }));
      })
      .addToggle((tg) => {
        tg.setTooltip(t("settings.ruleEnabled"));
        tg.setValue(rule.enabled);
        tg.onChange((v) => this.updateRule(rule.id, { enabled: v }, true));
      })
      .addExtraButton((b) => {
        b.setIcon("arrow-up").setTooltip(t("settings.ruleUp")).setDisabled(index === 0);
        b.onClick(() => this.writeRules((rs) => move(rs, index, index - 1), true));
      })
      .addExtraButton((b) => {
        b.setIcon("arrow-down").setTooltip(t("settings.ruleDown")).setDisabled(index === count - 1);
        b.onClick(() => this.writeRules((rs) => move(rs, index, index + 1), true));
      })
      .addExtraButton((b) => {
        b.setIcon("trash").setTooltip(t("settings.ruleDelete"));
        b.onClick(() => this.writeRules((rs) => rs.filter((r) => r.id !== rule.id), true));
      });

    const cond = new Setting(box).setName(t("settings.ruleCondition"));
    if (!isConditionValid(rule.condition)) {
      cond.setDesc(t("settings.ruleInvalid"));
      cond.descEl.addClass("cwt-template-missing");
    }
    cond.addDropdown((d) => {
      RULE_CONDITION_TYPES.forEach((type) => d.addOption(type, t(`cond.${type}` as I18nKey)));
      d.setValue(rule.condition.type);
      d.onChange((v) =>
        this.updateRule(rule.id, { condition: defaultCondition(v as RuleConditionType) }, true)
      );
    });
    this.renderConditionParams(cond, rule);

    const applies = new Setting(box).setName(t("settings.ruleAppliesTo"));
    const current = rule.appliesTo?.length ? rule.appliesTo : ["day"];
    (["day", "week", "month"] as Granularity[]).forEach((g) => {
      const label = applies.controlEl.createEl("label", { cls: "cwt-check" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = current.includes(g);
      label.appendText(typeLabel(g));
      cb.addEventListener("change", () => {
        const next = (["day", "week", "month"] as Granularity[]).filter((x) =>
          x === g ? cb.checked : current.includes(x)
        );
        void this.updateRule(rule.id, { appliesTo: next.length ? next : ["day"] }, true);
      });
    });

    const tpl = new Setting(box).setName(t("settings.ruleTemplate"));
    tpl.addSearch((search) => {
      new FileSuggest(this.app, search.inputEl);
      search.setPlaceholder("Templates/…");
      search.setValue(rule.template);
      search.onChange(async (v) => {
        await this.updateRule(rule.id, { template: v.trim() });
        this.validateTemplate(tpl, v, "");
      });
      this.validateTemplate(tpl, rule.template, "");
    });
  }

  private renderConditionParams(setting: Setting, rule: ITemplateRule): void {
    const c = rule.condition;
    const set = (condition: RuleCondition, rerender = false) =>
      this.updateRule(rule.id, { condition }, rerender);
    const dateInput = (value: string, onChange: (v: string) => void, label?: string) => {
      if (label) {
        setting.controlEl.createSpan({ cls: "cwt-cond-label", text: label });
      }
      const input = setting.controlEl.createEl("input", { type: "date", cls: "cwt-date-input" });
      input.value = value;
      input.addEventListener("change", () => onChange(input.value));
    };

    switch (c.type) {
      case "date":
        dateInput(c.date, (v) => set({ type: "date", date: v }, true));
        break;
      case "range":
        dateInput(c.from, (v) => set({ ...c, from: v }, true), t("cond.from"));
        dateInput(c.to, (v) => set({ ...c, to: v }, true), t("cond.to"));
        break;
      case "annual":
        setting.addText((text) => {
          text.setPlaceholder(t("cond.monthDayPlaceholder"));
          text.setValue(c.monthDay);
          text.inputEl.size = 6;
          text.onChange((v) => set({ type: "annual", monthDay: v.trim() }));
        });
        break;
      case "nthWeekday":
        setting.addDropdown((d) => {
          [1, 2, 3, 4, 5].forEach((n) => d.addOption(String(n), t(`cond.nth${n}` as I18nKey)));
          d.addOption("-1", t("cond.nthLast"));
          d.setValue(String(c.nth));
          d.onChange((v) => set({ ...c, nth: Number(v) }));
        });
        setting.addDropdown((d) => {
          window.moment.weekdays().forEach((name, i) => d.addOption(String(i), name));
          d.setValue(String(c.weekday));
          d.onChange((v) => set({ ...c, weekday: Number(v) }));
        });
        break;
      case "weekParity":
        setting.addDropdown((d) => {
          d.addOption("even", t("cond.even"));
          d.addOption("odd", t("cond.odd"));
          d.setValue(c.parity);
          d.onChange((v) => set({ type: "weekParity", parity: v as "even" | "odd" }));
        });
        break;
    }
  }

  // ---------- advanced ----------

  private addLocaleOverride(): void {
    const sysLocale = navigator.language?.toLowerCase();
    new Setting(this.containerEl)
      .setName(t("settings.locale"))
      .setDesc(t("settings.localeDesc"))
      .addDropdown((d) => {
        d.addOption("system-default", t("settings.localeSystem", { locale: sysLocale }));
        window.moment.locales().forEach((l) => d.addOption(l, l));
        d.setValue(this.options.localeOverride);
        d.onChange(async (v) => {
          await this.write(() => ({ localeOverride: v as ILocaleOverride }));
        });
      });
  }
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) {
    return arr;
  }
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
