import {
  clampHorizon,
  makeDefaultSettings,
  mergeExternal,
  migrateSettings,
  SETTINGS_VERSION,
  shouldOpenOnStartup,
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
      folderLayout: "flat",
    });
    expect(settings.weekly).toEqual({
      enabled: true,
      folder: "Weekly",
      format: "gggg-[W]ww",
      template: "T/Week.md",
      folderLayout: "flat",
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
      folderLayout: "flat",
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
      folderLayout: "flat",
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
      "2026-11-10": {
        color: "red",
        prepDays: 30,
        events: [{ id: "e-2026-11-10-0", title: "Exam" }],
      },
    });
  });

  it("import keeps the enabled flag", () => {
    const base = { enabled: false, folder: "", format: "YYYY-MM", template: "" };
    expect(mergeExternal(base, { folder: "M", format: "", template: "T/M.md" }, "month")).toEqual({
      enabled: false,
      folder: "M",
      format: "YYYY-MM",
      template: "T/M.md",
      folderLayout: "flat",
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
    expect(settings.settingsVersion).toBe(12);
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

  it("derives folderLayout from yearFolders, clamps horizon, sanitizes journal", () => {
    const { settings } = migrateSettings({
      settingsVersion: 5,
      daily: { enabled: true, folder: "D", format: "YYYY-MM-DD", template: "", yearFolders: true },
      upcomingHorizonDays: 1000,
      lastOrganize: {
        at: "x",
        moves: [{ from: "D/a.md", to: "D/2026/a.md" }, { from: "../x.md", to: "y.md" }, 5],
      },
    });
    expect(settings.daily.folderLayout).toBe("year");
    expect(settings.daily.folderLayout).toBe("year");
    expect(settings.upcomingHorizonDays).toBe(365);
    expect(settings.lastOrganize?.moves).toEqual([{ from: "D/a.md", to: "D/2026/a.md", year: "" }]);
    expect(
      migrateSettings({ upcomingHorizonDays: 2, settingsVersion: 5 }).settings.upcomingHorizonDays,
    ).toBe(2);
    expect(
      migrateSettings({ upcomingHorizonDays: 1, settingsVersion: 5 }).settings.upcomingHorizonDays,
    ).toBe(2);
  });
});

describe("v6 (2.5.0): open daily note on startup", () => {
  it("is off by default and after migration; only true is kept", () => {
    expect(migrateSettings(null).settings.openDailyOnStartup).toBe(false);
    expect(migrateSettings({ settingsVersion: 5 }).settings.openDailyOnStartup).toBe(false);
    expect(
      migrateSettings({ settingsVersion: 6, openDailyOnStartup: "yes" }).settings
        .openDailyOnStartup,
    ).toBe(false);
    expect(
      migrateSettings({ settingsVersion: 6, openDailyOnStartup: true }).settings.openDailyOnStartup,
    ).toBe(true);
    expect(migrateSettings({ settingsVersion: 5 }).migratedFrom).toBe(5);
  });
  it("fires only at app start, not on plugin enable / reload", () => {
    expect(shouldOpenOnStartup(true, false, true)).toBe(true);
    expect(shouldOpenOnStartup(true, true, true)).toBe(false);
    expect(shouldOpenOnStartup(false, false, true)).toBe(false);
    expect(shouldOpenOnStartup(true, false, false)).toBe(false);
  });
});

describe("2.5.1: grid display switches", () => {
  it("default on, only false turns off, rest of settings untouched", () => {
    const d = migrateSettings(null).settings;
    expect([d.showHolidayMarks, d.showImportantMarks]).toEqual([true, true]);
    const s = migrateSettings({
      settingsVersion: 6,
      showHolidayMarks: false,
      showImportantMarks: "no",
      showUpcoming: true,
    }).settings;
    expect([s.showHolidayMarks, s.showImportantMarks, s.showUpcoming]).toEqual([false, true, true]);
  });
});

describe("2.7.0 migration (v8)", () => {
  it("v7 data gets random defaults; hidden menu position accepted", () => {
    const { settings } = migrateSettings({ settingsVersion: 7, menuPosition: "hidden" });
    expect(SETTINGS_VERSION).toBe(12);
    expect(settings.settingsVersion).toBe(12);
    expect(settings.menuPosition).toBe("hidden");
    expect(settings.random).toEqual({
      ranges: [{ kind: "all", days: 30, from: "", to: "", month: 1, year: 0 }],
      skipEmpty: false,
    });
    const s2 = migrateSettings({
      settingsVersion: 8,
      random: { kind: "range", days: 5, from: "2027-01-01", to: "2027-02-01", skipEmpty: true },
    }).settings;
    expect(s2.random.ranges[0].kind).toBe("range");
    expect(s2.random.ranges[0].from).toBe("2027-01-01");
    expect(s2.random.skipEmpty).toBe(true);
    expect(makeDefaultSettings().random.ranges[0].kind).toBe("all");
  });
});

describe("v11 (2.10.0): folderLayout", () => {
  it("derives folderLayout from yearFolders; folderLayout wins when both are present", () => {
    const { settings: a } = migrateSettings({
      settingsVersion: 10,
      daily: { enabled: true, folder: "D", format: "YYYY-MM-DD", template: "", yearFolders: true },
    });
    expect(a.daily.folderLayout).toBe("year");
    expect("yearFolders" in a.daily).toBe(false);
    expect(a.settingsVersion).toBe(12);

    const { settings: b } = migrateSettings({
      settingsVersion: 11,
      daily: {
        enabled: true,
        folder: "D",
        format: "YYYY-MM-DD",
        template: "",
        folderLayout: "year-month",
        yearFolders: false,
      },
    });
    expect(b.daily.folderLayout).toBe("year-month");
    expect("yearFolders" in b.daily).toBe(false);

    const { settings: c } = migrateSettings(null);
    expect(c.daily.folderLayout).toBe("flat");
  });
});


describe("v12 (2.12.0): multi-range random", () => {
  it("migrates legacy single-range random into ranges[]", () => {
    const { settings } = migrateSettings({
      settingsVersion: 11,
      random: { kind: "lastDays", days: 14, from: "", to: "", skipEmpty: true },
    });
    expect(settings.settingsVersion).toBe(12);
    expect(settings.random.ranges).toHaveLength(1);
    expect(settings.random.ranges[0]).toMatchObject({ kind: "lastDays", days: 14 });
    expect(settings.random.skipEmpty).toBe(true);
  });

  it("keeps multi-range prefs", () => {
    const { settings } = migrateSettings({
      settingsVersion: 12,
      random: {
        ranges: [
          { kind: "year", days: 30, from: "", to: "", month: 1, year: 0 },
          { kind: "month", days: 30, from: "", to: "", month: 3, year: 0 },
        ],
        skipEmpty: false,
      },
    });
    expect(settings.random.ranges).toHaveLength(2);
    expect(settings.random.ranges[1].month).toBe(3);
  });
});

describe("1.1.0: horizon minimum and titleRight menu position", () => {
  it("clamps the look-ahead horizon to 2..365", () => {
    expect(clampHorizon(1)).toBe(2);
    expect(clampHorizon(2)).toBe(2);
    expect(clampHorizon(7)).toBe(7);
    expect(clampHorizon(0)).toBe(2);
    expect(clampHorizon(-3)).toBe(2);
    expect(clampHorizon(366)).toBe(365);
    expect(clampHorizon("nope")).toBe(60);
  });

  it("accepts titleRight and keeps existing positions through migration", () => {
    expect(migrateSettings({ menuPosition: "titleRight" }).settings.menuPosition).toBe("titleRight");
    expect(migrateSettings({ menuPosition: "titleLeft" }).settings.menuPosition).toBe("titleLeft");
    expect(migrateSettings({ menuPosition: "navRight" }).settings.menuPosition).toBe("navRight");
    expect(migrateSettings({ menuPosition: "afterYear" }).settings.menuPosition).toBe("navRight");
  });
});
