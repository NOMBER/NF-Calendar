import { Notice, PluginSettingTab, Setting } from "obsidian";
import type { SliderComponent, TextComponent } from "obsidian";
import type { App } from "obsidian";
import { get } from "svelte/store";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import type { Granularity } from "src/core/dates";
import {
  defaultCondition,
  EMPTY_WEEKDAY_TEMPLATES,
  isConditionValid,
  newRuleId,
  orderedWeekdays,
  RULE_CONDITION_GROUPS,
  WEEKDAY_KEYS,
} from "src/core/rules";
import { DOTS_MODES, sanitizeDotsMode } from "src/core/dots";
import { t } from "src/core/i18n";
import type { I18nKey } from "src/core/i18n";
import type { ITemplateRule, RuleCondition, RuleConditionType } from "src/core/rules";
import { isValidHolidayPattern } from "src/core/holidays";
import type { HolidayDateOrder } from "src/core/holidays";
import {
  clampHorizon,
  HORIZON_MAX,
  HORIZON_MIN,
  MENU_POSITIONS,
  mergeExternal,
} from "src/core/settings";
import type { IPeriodicConfig, ISettings, Language, MenuPosition } from "src/core/settings";
import { readExternalPeriodicSettings } from "src/io/external";
import { holidayStore } from "src/io/holidays";
import { getNotePath, resolveTemplateFile } from "src/io/notes";
import type CalendarPlugin from "src/main";
import { FileSuggest } from "./fileSuggest";
import { typeLabel } from "./labels";

const pad = (n: number) => String(n).padStart(2, "0");

const WEEK_START_KEYS = WEEKDAY_KEYS; // sunday..saturday, same as calendar-ui

export class CalendarSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: CalendarPlugin,
  ) {
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
    this.addDotsMode();
    this.addWeekStart();
    this.addConfirm();
    this.addPreview();
    this.addUpcoming();
    this.addMenuPosition();

    this.addPeriodicSection("day");
    this.addPeriodicSection("week");
    this.addPeriodicSection("month");
    this.addImport();

    this.heading(t("settings.holidays"));
    this.addHolidays();

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

  private addDotsMode(): void {
    new Setting(this.containerEl)
      .setName(t("settings.dotsMode"))
      .setDesc(t("settings.dotsModeDesc"))
      .addDropdown((d) => {
        for (const mode of DOTS_MODES) {
          d.addOption(mode, t(`dots.${mode}` as I18nKey));
        }
        d.setValue(sanitizeDotsMode(this.options.dotsMode));
        d.onChange(async (v) => {
          await this.write(() => ({ dotsMode: sanitizeDotsMode(v) }));
          this.plugin.getView()?.refresh();
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
    const setting = new Setting(this.containerEl)
      .setName(t("settings.horizon"))
      .setDesc(t("settings.horizonDesc"));
    let slider: SliderComponent | null = null;
    let input: TextComponent | null = null;
    const save = async (v: unknown, from: "slider" | "input" | "blur") => {
      const n = clampHorizon(v);
      if (from !== "slider") {
        slider?.setValue(n);
      }
      if (from !== "input" || String(n) !== input?.getValue()) {
        input?.setValue(String(n));
      }
      await this.write(() => ({ upcomingHorizonDays: n }));
    };
    setting.addSlider((s) => {
      slider = s;
      s.setLimits(HORIZON_MIN, HORIZON_MAX, 1)
        .setValue(this.options.upcomingHorizonDays)
        .setDynamicTooltip()
        .onChange((v) => save(v, "slider"));
    });
    setting.addText((text) => {
      input = text;
      text.inputEl.type = "number";
      text.inputEl.min = String(HORIZON_MIN);
      text.inputEl.max = String(HORIZON_MAX);
      text.inputEl.addClass("cwt-number-input");
      text.setValue(String(this.options.upcomingHorizonDays));
      // Clamp on blur / Enter, so typing "2" on the way to "20" is not forced to 7.
      const commit = () => {
        if (text.getValue().trim() !== "") {
          void save(text.getValue(), "blur");
        } else {
          text.setValue(String(this.options.upcomingHorizonDays));
        }
      };
      text.inputEl.addEventListener("blur", commit);
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          commit();
        }
      });
    });
  }

  private firstDayOfWeek(): number {
    const weekStart = this.options.weekStart;
    const firstDay =
      weekStart && weekStart !== "locale"
        ? WEEK_START_KEYS.indexOf(weekStart as (typeof WEEK_START_KEYS)[number])
        : (window._bundledLocaleWeekSpec?.dow ?? window.moment.localeData().firstDayOfWeek());
    return firstDay < 0 ? 1 : firstDay;
  }

  private addMenuPosition(): void {
    new Setting(this.containerEl)
      .setName(t("settings.menuPosition"))
      .setDesc(t("settings.menuPositionDesc"))
      .addDropdown((d) => {
        MENU_POSITIONS.forEach((p) => d.addOption(p, t(`menuPos.${p}` as I18nKey)));
        d.setValue(this.options.menuPosition);
        d.onChange(async (v) => {
          await this.write(() => ({ menuPosition: v as MenuPosition }));
        });
      });
  }

  private addHolidays(): void {
    const { folder, index, unrecognized } = get(holidayStore);
    const folderSetting = new Setting(this.containerEl)
      .setName(t("settings.holidaysFolder"))
      .setDesc(
        folder
          ? t("settings.holidaysFound", {
              count: Object.values(index).reduce((n, l) => n + l.length, 0),
              bad: unrecognized.length,
            })
          : t("settings.holidaysFolderDesc"),
      );
    if (unrecognized.length) {
      folderSetting.descEl.createDiv({
        cls: "cwt-muted",
        text: t("settings.holidaysUnrecognized", {
          names: unrecognized.slice(0, 5).join(", ") + (unrecognized.length > 5 ? "…" : ""),
        }),
      });
    }
    folderSetting.addText((text) => {
      text.setPlaceholder("Meta/Dates");
      text.setValue(this.options.holidaysFolder);
      text.inputEl.addEventListener("blur", () => this.display());
      text.onChange(async (v) => {
        await this.write(() => ({ holidaysFolder: v.trim() }));
      });
    });
    new Setting(this.containerEl)
      .setName(t("settings.holidayOrder"))
      .setDesc(t("settings.holidayOrderDesc"))
      .addDropdown((d) => {
        d.addOption("dayFirst", t("settings.dayFirst"));
        d.addOption("monthFirst", t("settings.monthFirst"));
        d.setValue(this.options.holidayDateOrder);
        d.onChange(async (v) => {
          await this.write(() => ({ holidayDateOrder: v as HolidayDateOrder }));
          this.display();
        });
      });
    const pattern = new Setting(this.containerEl)
      .setName(t("settings.holidayPattern"))
      .setDesc(t("settings.holidayPatternDesc"));
    pattern.addText((text) => {
      text.setPlaceholder("DD.MM");
      text.setValue(this.options.holidayPattern);
      text.onChange(async (v) => {
        const value = v.trim();
        const ok = !value || isValidHolidayPattern(value);
        pattern.descEl.toggleClass("cwt-template-missing", !ok);
        pattern.setDesc(ok ? t("settings.holidayPatternDesc") : t("settings.holidayPatternBad"));
        if (ok) {
          await this.write(() => ({ holidayPattern: value }));
        }
      });
    });
  }

  private toggle(
    name: string,
    desc: string,
    key:
      "shouldConfirmBeforeCreate" | "showTemplatePreview" | "showUpcoming" | "useWeekdayTemplates",
    rerender = false,
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((tg) => {
        tg.setValue(!!this.options[key]);
        tg.onChange(async (v) => {
          await this.write(() => ({ [key]: v }) as Partial<ISettings>);
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
    await this.write((old) => ({ [key]: { ...old[key], ...patch } }) as Partial<ISettings>);
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

    const folderSetting = new Setting(this.containerEl).setName(t("settings.folder"));
    // Folder and format together decide the path; warn if it leaves the vault.
    const checkPath = () => {
      const unsafe =
        getNotePath(window.moment(), this.options, g, this.app.vault.configDir) === null;
      folderSetting.setDesc(unsafe ? t("settings.unsafePath") : t("settings.folderDesc"));
      folderSetting.descEl.toggleClass("cwt-template-missing", unsafe);
    };
    folderSetting.addText((text) => {
      text.setPlaceholder("/");
      text.setValue(cfg.folder);
      text.onChange(async (v) => {
        await this.writePeriodic(g, { folder: v.trim() });
        checkPath();
      });
    });
    checkPath();

    const formatSetting = new Setting(this.containerEl).setName(t("settings.format"));
    const updateSample = (format: string) =>
      formatSetting.setDesc(
        t("settings.formatDesc", { sample: window.moment().format(format || "YYYY-MM-DD") }),
      );
    updateSample(cfg.format);
    formatSetting.addText((text) => {
      text.setValue(cfg.format);
      text.onChange(async (v) => {
        updateSample(v.trim());
        if (v.trim()) {
          await this.writePeriodic(g, { format: v.trim() });
          checkPath();
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

    if (g === "day") {
      new Setting(this.containerEl)
        .setName(t("settings.yearFolders"))
        .setDesc(t("settings.yearFoldersDesc"))
        .addToggle((tg) => {
          tg.setValue(!!cfg.yearFolders);
          tg.onChange(async (v) => {
            await this.writePeriodic(g, { yearFolders: v });
          });
        });
      new Setting(this.containerEl)
        .setName(t("cmd.organize"))
        .setDesc(t("settings.organizeDesc"))
        .addButton((b) =>
          b.setButtonText(t("settings.organizeButton")).onClick(() => {
            this.plugin.organizeDailyNotes();
          }),
        )
        .addButton((b) => {
          b.setButtonText(t("cmd.undoOrganize")).onClick(() => void this.plugin.undoLastOrganize());
          b.setDisabled(!this.options.lastOrganize);
        });
    }
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
            found.length
              ? t("notice.importDone", { what: found.join(", ") })
              : t("notice.importNothing"),
          );
          this.plugin.reindexAll();
          this.display();
        }),
      );
  }

  // ---------- weekday templates ----------

  private addWeekdayTemplates(): void {
    this.toggle(
      t("settings.useWeekday"),
      t("settings.useWeekdayDesc"),
      "useWeekdayTemplates",
      true,
    );
    if (!this.options.useWeekdayTemplates) {
      return;
    }
    const { moment } = window;
    const firstDay = this.firstDayOfWeek();
    const names = moment.weekdays();
    const desc = t("settings.weekdayTemplateDesc");
    for (const day of orderedWeekdays(firstDay)) {
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
            weekdayTemplates: {
              ...EMPTY_WEEKDAY_TEMPLATES,
              ...(old.weekdayTemplates || {}),
              [day]: v.trim(),
            },
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

  private async writeRules(
    fn: (rules: ITemplateRule[]) => ITemplateRule[],
    rerender = false,
  ): Promise<void> {
    await this.write((old) => ({ templateRules: fn(old.templateRules.map((r) => ({ ...r }))) }));
    if (rerender) {
      this.display();
    }
  }

  private updateRule(id: string, patch: Partial<ITemplateRule>, rerender = false): Promise<void> {
    return this.writeRules(
      (rules) => rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      rerender,
    );
  }

  private addRules(): void {
    this.containerEl.createEl("p", {
      cls: "setting-item-description",
      text: t("settings.rulesDesc"),
    });
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
            true,
          ),
        ),
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
        b.setIcon("arrow-up")
          .setTooltip(t("settings.ruleUp"))
          .setDisabled(index === 0);
        b.onClick(() => this.writeRules((rs) => move(rs, index, index - 1), true));
      })
      .addExtraButton((b) => {
        b.setIcon("arrow-down")
          .setTooltip(t("settings.ruleDown"))
          .setDisabled(index === count - 1);
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
      // Compact grouped picker: <optgroup> per family of conditions.
      for (const { group, types } of RULE_CONDITION_GROUPS) {
        const og = d.selectEl.createEl("optgroup", {
          attr: { label: t(`cond.group.${group}` as I18nKey) },
        });
        types.forEach((type) =>
          og.createEl("option", { value: type, text: t(`cond.${type}` as I18nKey) }),
        );
      }
      d.setValue(rule.condition.type);
      d.onChange((v) =>
        this.updateRule(rule.id, { condition: defaultCondition(v as RuleConditionType) }, true),
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
          x === g ? cb.checked : current.includes(x),
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

    const numberInput = (
      value: number,
      min: number,
      max: number,
      onChange: (n: number) => void,
      label?: string,
    ) => {
      if (label) {
        setting.controlEl.createSpan({ cls: "cwt-cond-label", text: label });
      }
      const input = setting.controlEl.createEl("input", {
        type: "number",
        cls: "cwt-number-input",
        attr: { min, max, step: 1 },
      });
      input.value = String(value);
      input.addEventListener("change", () => {
        const n = Math.round(Number(input.value));
        if (Number.isFinite(n) && n >= min && n <= max) {
          onChange(n);
        }
      });
    };

    switch (c.type) {
      case "date":
        dateInput(c.date, (v) => set({ type: "date", date: v }, true));
        break;
      case "range":
        dateInput(c.from, (v) => set({ ...c, from: v }, true), t("cond.from"));
        dateInput(c.to, (v) => set({ ...c, to: v }, true), t("cond.to"));
        break;
      case "annual": {
        const [mm, dd] = c.monthDay.split("-");
        setting.addDropdown((d) => {
          for (let i = 1; i <= 31; i++) {
            d.addOption(pad(i), String(i));
          }
          d.setValue(dd || "01");
          d.onChange((v) => set({ type: "annual", monthDay: `${mm || "01"}-${v}` }, true));
        });
        setting.addDropdown((d) => {
          window.moment.months().forEach((name, i) => d.addOption(pad(i + 1), name));
          d.setValue(mm || "01");
          d.onChange((v) => set({ type: "annual", monthDay: `${v}-${dd || "01"}` }, true));
        });
        break;
      }
      case "monthDays":
        numberInput(c.from, 1, 31, (n) => set({ ...c, from: n }, true), t("cond.from"));
        numberInput(c.to, 1, 31, (n) => set({ ...c, to: n }, true), t("cond.to"));
        break;
      case "lastDays":
        numberInput(c.count, 1, 31, (n) => set({ ...c, count: n }, true), t("cond.lastCount"));
        break;
      case "monthEdge":
        setting.addDropdown((d) => {
          d.addOption("first", t("cond.edgeFirst"));
          d.addOption("last", t("cond.edgeLast"));
          d.setValue(c.edge);
          d.onChange((v) => set({ type: "monthEdge", edge: v as "first" | "last" }));
        });
        break;
      case "quarterEdge":
        setting.addDropdown((d) => {
          d.addOption("start", t("cond.quarterStart"));
          d.addOption("end", t("cond.quarterEnd"));
          d.setValue(c.edge);
          d.onChange((v) => set({ type: "quarterEdge", edge: v as "start" | "end" }));
        });
        break;
      case "weekdays": {
        const box = setting.controlEl.createDiv("cwt-weekday-checks");
        const names = window.moment.weekdaysShort();
        const order = orderedWeekdays(this.firstDayOfWeek()).map((k) => WEEKDAY_KEYS.indexOf(k));
        for (const i of order) {
          const label = box.createEl("label", { cls: "cwt-check" });
          const cb = label.createEl("input", { type: "checkbox" });
          cb.checked = c.days.includes(i);
          label.appendText(names[i]);
          cb.addEventListener("change", () => {
            const days = cb.checked ? [...c.days, i] : c.days.filter((x) => x !== i);
            void set({ type: "weekdays", days: days.sort() }, true);
          });
        }
        const presets = setting.controlEl.createDiv("cwt-weekday-presets");
        const preset = (label: string, days: number[]) =>
          presets
            .createEl("button", { text: label, cls: "cwt-small-button" })
            .addEventListener("click", () => void set({ type: "weekdays", days }, true));
        preset(t("cond.workdays"), [1, 2, 3, 4, 5]);
        preset(t("cond.weekend"), [0, 6]);
        break;
      }
      case "weekOfMonth":
        setting.addDropdown((d) => {
          [1, 2, 3, 4, 5, 6].forEach((n) => d.addOption(String(n), t("cond.weekN", { n })));
          d.addOption("-1", t("cond.weekLast"));
          d.setValue(String(c.week));
          d.onChange((v) => set({ type: "weekOfMonth", week: Number(v) }));
        });
        break;
      case "everyNDays":
        numberInput(c.every, 1, 3660, (n) => set({ ...c, every: n }, true), t("cond.every"));
        dateInput(c.start, (v) => set({ ...c, start: v }, true), t("cond.startingFrom"));
        break;
      case "holiday":
        setting.controlEl.createSpan({ cls: "cwt-muted", text: t("cond.holidayHint") });
        break;
      case "important":
        setting.controlEl.createSpan({ cls: "cwt-muted", text: t("cond.importantHint") });
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
