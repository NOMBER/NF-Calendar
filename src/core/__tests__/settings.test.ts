import {
  makeDefaultSettings,
  mergeExternal,
  migrateSettings,
  SETTINGS_VERSION,
} from "src/core/settings";

describe("migrateSettings", () => {
  it("fresh install: defaults, nothing imported", () => {
    const { settings, migratedFrom } = migrateSettings(null, { daily: { folder: "X" } });
    expect(migratedFrom).toBeNull();
    expect(settings).toEqual(makeDefaultSettings());
    expect(settings.daily).toMatchObject({ enabled: true, folder: "", format: "YYYY-MM-DD" });
    expect(settings.weekly.enabled).toBe(false);
  });

  it("v1 → v2: keeps weekday templates, moves weekly fields, copies Daily Notes config once", () => {
    const v1 = {
      wordsPerDot: 100,
      weekStart: "monday",
      shouldConfirmBeforeCreate: false,
      showWeeklyNote: true,
      weeklyNoteFolder: "Weekly",
      weeklyNoteFormat: "",
      weeklyNoteTemplate: "T/Week.md",
      localeOverride: "ru",
      useWeekdayTemplates: true,
      weekdayTemplates: { monday: "T/Mon.md" },
    };
    const { settings, migratedFrom } = migrateSettings(v1, {
      daily: { folder: "Journal", format: "DD.MM.YYYY", template: "T/Daily.md" },
    });
    expect(migratedFrom).toBe(1);
    expect(settings.settingsVersion).toBe(SETTINGS_VERSION);
    expect(settings.daily).toEqual({
      enabled: true,
      folder: "Journal",
      format: "DD.MM.YYYY",
      template: "T/Daily.md",
    });
    expect(settings.weekly).toEqual({
      enabled: true,
      folder: "Weekly",
      format: "gggg-[W]ww",
      template: "T/Week.md",
    });
    expect(settings.monthly.enabled).toBe(false);
    expect(settings.weekdayTemplates.monday).toBe("T/Mon.md");
    expect(settings.weekdayTemplates.friday).toBe("");
    expect(settings).toMatchObject({
      dotsMode: "exists",
      weekStart: "monday",
      localeOverride: "ru",
      useWeekdayTemplates: true,
    });
    expect(settings.templateRules).toEqual([]);
    expect(settings.importantDays).toEqual({});
  });

  it("v1 with Periodic Notes weekly overrides the old weekly fields", () => {
    const { settings } = migrateSettings(
      { showWeeklyNote: false, weeklyNoteFolder: "Old" },
      { weekly: { folder: "PN/Weekly", format: "gggg-ww", template: "" } },
    );
    expect(settings.weekly).toEqual({
      enabled: false,
      folder: "PN/Weekly",
      format: "gggg-ww",
      template: "",
    });
  });

  it("v2: sanitizes rules and important days", () => {
    const { settings, migratedFrom } = migrateSettings({
      settingsVersion: 2,
      daily: { enabled: false, folder: " D ", format: "", template: "" },
      templateRules: [
        {
          id: "a",
          name: "A",
          condition: { type: "annual", monthDay: "01-01" },
          template: " T/NY.md ",
        },
        { broken: true },
      ],
      importantDays: {
        "2026-11-10": { title: "Exam", color: "nope", prepDays: 99 },
        garbage: { title: "x" },
      },
    });
    expect(migratedFrom).toBe(2);
    expect(settings.daily).toEqual({
      enabled: false,
      folder: "D",
      format: "YYYY-MM-DD",
      template: "",
    });
    expect(settings.templateRules).toEqual([
      {
        id: "a",
        name: "A",
        enabled: true,
        condition: { type: "annual", monthDay: "01-01" },
        template: "T/NY.md",
        appliesTo: ["day"],
      },
    ]);
    expect(settings.importantDays).toEqual({
      "2026-11-10": { title: "Exam", color: "red", prepDays: 30 },
    });
  });

  it("import keeps the enabled flag", () => {
    const base = { enabled: false, folder: "", format: "YYYY-MM", template: "" };
    expect(mergeExternal(base, { folder: "M", format: "", template: "T/M.md" }, "month")).toEqual({
      enabled: false,
      folder: "M",
      format: "YYYY-MM",
      template: "T/M.md",
    });
  });
});

describe("v3 (2.2.0) migration", () => {
  it("v2 data keeps its rules and gets v3 defaults", () => {
    const rules = [
      {
        id: "a",
        name: "A",
        enabled: true,
        condition: { type: "date", date: "2026-01-01" },
        template: "A.md",
        appliesTo: ["day"],
      },
      {
        id: "b",
        name: "B",
        enabled: true,
        condition: { type: "annual", monthDay: "03-08" },
        template: "B.md",
        appliesTo: ["day"],
      },
    ];
    const { settings, migratedFrom } = migrateSettings({
      settingsVersion: 2,
      templateRules: rules,
    });
    expect(migratedFrom).toBe(2);
    expect(settings.settingsVersion).toBe(5);
    expect(settings.templateRules).toEqual(rules);
    expect(settings.holidaysFolder).toBe("");
    expect(settings.holidayDateOrder).toBe("dayFirst");
    expect(settings.menuPosition).toBe("navRight");
    expect(settings.statsView).toEqual({ mode: "table", metric: "words", kind: "bar" });
  });

  it("sanitizes v3 fields", () => {
    const { settings, migratedFrom } = migrateSettings({
      settingsVersion: 3,
      holidaysFolder: " Meta/Dates ",
      holidayDateOrder: "monthFirst",
      holidayPattern: "(a+)+$",
      menuPosition: "somewhere",
      statsView: { mode: "charts", metric: "tasks", kind: "pie" },
    });
    expect(migratedFrom).toBe(3);
    expect(settings.holidaysFolder).toBe("Meta/Dates");
    expect(settings.holidayDateOrder).toBe("monthFirst");
    expect(settings.holidayPattern).toBe("");
    expect(settings.menuPosition).toBe("navRight");
    expect(settings.statsView).toEqual({ mode: "charts", metric: "tasks", kind: "bar" });
  });
});

describe("v5 (2.4.0) migration", () => {
  it("switches the old explicit default tasks → exists once", () => {
    expect(migrateSettings({ settingsVersion: 4, dotsMode: "tasks" }).settings.dotsMode).toBe(
      "exists",
    );
    expect(migrateSettings({ settingsVersion: 4, dotsMode: "words" }).settings.dotsMode).toBe(
      "words",
    );
    expect(migrateSettings({ settingsVersion: 5, dotsMode: "tasks" }).settings.dotsMode).toBe(
      "tasks",
    );
    expect(migrateSettings(null).settings.dotsMode).toBe("exists");
  });

  it("keeps yearFolders, clamps horizon, sanitizes journal", () => {
    const { settings } = migrateSettings({
      settingsVersion: 5,
      daily: { enabled: true, folder: "D", format: "YYYY-MM-DD", template: "", yearFolders: true },
      upcomingHorizonDays: 1000,
      lastOrganize: {
        at: "x",
        moves: [{ from: "D/a.md", to: "D/2026/a.md" }, { from: "../x.md", to: "y.md" }, 5],
      },
    });
    expect(settings.daily.yearFolders).toBe(true);
    expect(settings.upcomingHorizonDays).toBe(365);
    expect(settings.lastOrganize?.moves).toEqual([{ from: "D/a.md", to: "D/2026/a.md", year: "" }]);
    expect(
      migrateSettings({ upcomingHorizonDays: 2, settingsVersion: 5 }).settings.upcomingHorizonDays,
    ).toBe(7);
  });
});
