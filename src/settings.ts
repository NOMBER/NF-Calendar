import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import {
  appHasDailyNotesPluginLoaded,
  getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import type { ILocaleOverride, IWeekStartOption } from "obsidian-calendar-ui";

import { DEFAULT_WEEK_FORMAT, DEFAULT_WORDS_PER_DOT } from "src/constants";

import {
  EMPTY_WEEKDAY_TEMPLATES,
  orderedWeekdays,
} from "src/io/weekdayTemplates";
import type { IWeekdayTemplates, WeekdayKey } from "src/io/weekdayTemplates";
import { FileSuggest } from "src/ui/fileSuggest";

import type CalendarPlugin from "./main";

export interface ISettings {
  wordsPerDot: number;
  weekStart: IWeekStartOption;
  shouldConfirmBeforeCreate: boolean;

  // Weekly Note settings
  showWeeklyNote: boolean;
  weeklyNoteFormat: string;
  weeklyNoteTemplate: string;
  weeklyNoteFolder: string;

  localeOverride: ILocaleOverride;

  // Weekday templates for daily notes
  useWeekdayTemplates: boolean;
  weekdayTemplates: IWeekdayTemplates;
}

const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const defaultSettings = Object.freeze({
  shouldConfirmBeforeCreate: true,
  weekStart: "locale" as IWeekStartOption,

  wordsPerDot: DEFAULT_WORDS_PER_DOT,

  showWeeklyNote: false,
  weeklyNoteFormat: "",
  weeklyNoteTemplate: "",
  weeklyNoteFolder: "",

  localeOverride: "system-default",

  useWeekdayTemplates: false,
  weekdayTemplates: { ...EMPTY_WEEKDAY_TEMPLATES },
});

export function appHasPeriodicNotesPluginLoaded(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodicNotes = (<any>window.app).plugins.getPlugin("periodic-notes");
  return periodicNotes && periodicNotes.settings?.weekly?.enabled;
}

export class CalendarSettingsTab extends PluginSettingTab {
  private plugin: CalendarPlugin;

  constructor(app: App, plugin: CalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    if (!appHasDailyNotesPluginLoaded()) {
      this.containerEl.createDiv("settings-banner", (banner) => {
        banner.createEl("h3", {
          text: "⚠️ Daily Notes plugin not enabled",
        });
        banner.createEl("p", {
          cls: "setting-item-description",
          text:
            "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
        });
      });
    }

    this.containerEl.createEl("h3", {
      text: "General Settings",
    });
    this.addDotThresholdSetting();
    this.addWeekStartSetting();
    this.addConfirmCreateSetting();
    this.addShowWeeklyNoteSetting();

    this.containerEl.createEl("h3", {
      text: "Daily Note Templates by Weekday",
    });
    this.addUseWeekdayTemplatesSetting();
    if (this.plugin.options.useWeekdayTemplates) {
      this.addWeekdayTemplateSettings();
    }

    if (
      this.plugin.options.showWeeklyNote &&
      !appHasPeriodicNotesPluginLoaded()
    ) {
      this.containerEl.createEl("h3", {
        text: "Weekly Note Settings",
      });
      this.containerEl.createEl("p", {
        cls: "setting-item-description",
        text:
          "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
      });
      this.addWeeklyNoteFormatSetting();
      this.addWeeklyNoteTemplateSetting();
      this.addWeeklyNoteFolderSetting();
    }

    this.containerEl.createEl("h3", {
      text: "Advanced Settings",
    });
    this.addLocaleOverrideSetting();
  }

  addDotThresholdSetting(): void {
    new Setting(this.containerEl)
      .setName("Words per dot")
      .setDesc("How many words should be represented by a single dot?")
      .addText((textfield) => {
        textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
        textfield.inputEl.type = "number";
        textfield.setValue(String(this.plugin.options.wordsPerDot));
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            wordsPerDot: value !== "" ? Number(value) : undefined,
          }));
        });
      });
  }

  addWeekStartSetting(): void {
    const { moment } = window;

    const localizedWeekdays = moment.weekdays();
    const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
    const localeWeekStart = moment.weekdays()[localeWeekStartNum];

    new Setting(this.containerEl)
      .setName("Start week on:")
      .setDesc(
        "Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
        localizedWeekdays.forEach((day, i) => {
          dropdown.addOption(weekdays[i], day);
        });
        dropdown.setValue(this.plugin.options.weekStart);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            weekStart: value as IWeekStartOption,
          }));
        });
      });
  }

  addConfirmCreateSetting(): void {
    new Setting(this.containerEl)
      .setName("Confirm before creating new note")
      .setDesc("Show a confirmation modal before creating a new note")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            shouldConfirmBeforeCreate: value,
          }));
        });
      });
  }

  addShowWeeklyNoteSetting(): void {
    new Setting(this.containerEl)
      .setName("Show week number")
      .setDesc("Enable this to add a column with the week number")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.showWeeklyNote);
        toggle.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
          this.display(); // show/hide weekly settings
        });
      });
  }

  addUseWeekdayTemplatesSetting(): void {
    new Setting(this.containerEl)
      .setName("Use a separate template for each weekday")
      .setDesc(
        "When a daily note is created from the calendar (or with this plugin's commands), use the template of the weekday of THAT note's date. Empty fields fall back to the template from Daily Notes / Periodic Notes."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.options.useWeekdayTemplates);
        toggle.onChange(async (value) => {
          await this.plugin.writeOptions(() => ({ useWeekdayTemplates: value }));
          this.display();
        });
      });
  }

  addWeekdayTemplateSettings(): void {
    const { moment } = window;
    const fallback = getDailyNoteSettings()?.template || "";
    this.containerEl.createEl("p", {
      cls: "setting-item-description",
      text: fallback
        ? `Fallback for empty fields: '${fallback}' (from Daily Notes / Periodic Notes settings).`
        : "Fallback for empty fields: no default daily note template is set, so an empty note will be created.",
    });

    const weekStart = this.plugin.options.weekStart;
    const firstDay =
      weekStart && weekStart !== "locale"
        ? weekdays.indexOf(weekStart)
        : window._bundledLocaleWeekSpec?.dow ?? moment.localeData().firstDayOfWeek();
    const englishNames: Record<WeekdayKey, string> = {
      sunday: "Sunday",
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
    };

    orderedWeekdays(firstDay < 0 ? 1 : firstDay).forEach((day) => {
      const setting = new Setting(this.containerEl)
        .setName(`${englishNames[day]} template`)
        .setDesc("Path to a markdown file. Leave empty to use the fallback.");
      setting.addSearch((search) => {
        new FileSuggest(this.app, search.inputEl);
        search.setPlaceholder("Templates/Daily " + englishNames[day]);
        search.setValue(this.plugin.options.weekdayTemplates?.[day] || "");
        search.onChange(async (value) => {
          await this.plugin.writeOptions((old) => ({
            weekdayTemplates: {
              ...EMPTY_WEEKDAY_TEMPLATES,
              ...(old.weekdayTemplates || {}),
              [day]: value.trim(),
            },
          }));
          this.validateTemplatePath(setting, value);
        });
        this.validateTemplatePath(setting, search.getValue());
      });
    });
  }

  validateTemplatePath(setting: Setting, value: string): void {
    const path = (value || "").trim();
    const desc = "Path to a markdown file. Leave empty to use the fallback.";
    if (!path) {
      setting.setDesc(desc);
      setting.descEl.removeClass("calendar-weekday-template-missing");
      return;
    }
    const withExt = path.endsWith(".md") ? path : `${path}.md`;
    const found =
      this.app.vault.getAbstractFileByPath(withExt) ||
      this.app.metadataCache.getFirstLinkpathDest(path.replace(/\.md$/, ""), "");
    if (found) {
      setting.setDesc(desc);
      setting.descEl.removeClass("calendar-weekday-template-missing");
    } else {
      setting.setDesc("⚠️ File not found. The fallback template will be used.");
      setting.descEl.addClass("calendar-weekday-template-missing");
    }
  }

  addWeeklyNoteFormatSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note format")
      .setDesc("For more syntax help, refer to format reference")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFormat);
        textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
        });
      });
  }

  addWeeklyNoteTemplateSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note template")
      .setDesc(
        "Choose the file you want to use as the template for your weekly notes"
      )
      .addText((textfield) => {
        new FileSuggest(this.app, textfield.inputEl);
        textfield.setValue(this.plugin.options.weeklyNoteTemplate);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
        });
      });
  }

  addWeeklyNoteFolderSetting(): void {
    new Setting(this.containerEl)
      .setName("Weekly note folder")
      .setDesc("New weekly notes will be placed here")
      .addText((textfield) => {
        textfield.setValue(this.plugin.options.weeklyNoteFolder);
        textfield.onChange(async (value) => {
          this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
        });
      });
  }

  addLocaleOverrideSetting(): void {
    const { moment } = window;

    const sysLocale = navigator.language?.toLowerCase();

    new Setting(this.containerEl)
      .setName("Override locale:")
      .setDesc(
        "Set this if you want to use a locale different from the default"
      )
      .addDropdown((dropdown) => {
        dropdown.addOption("system-default", `Same as system (${sysLocale})`);
        moment.locales().forEach((locale) => {
          dropdown.addOption(locale, locale);
        });
        dropdown.setValue(this.plugin.options.localeOverride);
        dropdown.onChange(async (value) => {
          this.plugin.writeOptions(() => ({
            localeOverride: value as ILocaleOverride,
          }));
        });
      });
  }
}
