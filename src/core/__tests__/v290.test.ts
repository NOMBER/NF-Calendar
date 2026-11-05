import {
  migrateSettings,
  sanitizeDismissedUpcoming,
  sanitizeImportant,
  SETTINGS_VERSION,
} from "../settings";
import {
  resolveUpcomingFilter,
  sanitizeUpcomingFilter,
  upcomingFilterLabelKey,
} from "../important";

describe("v2.9.0 settings (version 10)", () => {
  it("bumps SETTINGS_VERSION to current", () => {
    expect(SETTINGS_VERSION).toBe(12);
  });

  it("migrates single-title important days to events[]", () => {
    const { settings, migratedFrom } = migrateSettings({
      settingsVersion: 9,
      importantDays: {
        "2026-11-10": { title: "Exam", color: "blue", prepDays: 2 },
      },
    });
    expect(migratedFrom).toBe(9);
    expect(settings.settingsVersion).toBe(12);
    expect(settings.importantDays["2026-11-10"]).toEqual({
      color: "blue",
      prepDays: 2,
      events: [{ id: "e-2026-11-10-0", title: "Exam" }],
    });
    expect(settings.upcomingFilter).toBe("all");
    expect(settings.dismissedUpcoming).toEqual([]);
  });

  it("keeps multi-event days and filter / dismiss set", () => {
    const { settings } = migrateSettings({
      settingsVersion: 10,
      importantDays: {
        "2026-12-01": {
          color: "red",
          prepDays: 1,
          events: [
            { id: "x1", title: "A" },
            { id: "x2", title: "B" },
          ],
        },
      },
      upcomingFilter: "holidays",
      dismissedUpcoming: ["i:2026-12-01:x1", "h:2026-12-01:H/f.md", "bad", "i:nope"],
    });
    expect(settings.importantDays["2026-12-01"].events).toHaveLength(2);
    expect(settings.upcomingFilter).toBe("holidays");
    expect(settings.dismissedUpcoming).toEqual(["i:2026-12-01:x1", "h:2026-12-01:H/f.md"]);
  });

  it("sanitizeImportant / filter / dismiss", () => {
    const out = sanitizeImportant({
      "2026-10-30": { title: "x".repeat(1000), color: "javascript:alert(1)", prepDays: 999 },
      "2026-10-31": {
        color: "green",
        prepDays: 0,
        events: [{ id: "ok", title: "Hi" }, { id: "../x", title: "BadId" }, null],
      },
    });
    expect(out["2026-10-30"].events[0].title).toHaveLength(200);
    expect(out["2026-10-30"].color).toBe("red");
    expect(out["2026-10-31"].events.map((e) => e.id)).toEqual(["ok", "e-2026-10-31-1"]);
    expect(sanitizeUpcomingFilter("important")).toBe("important");
    expect(sanitizeUpcomingFilter("nope")).toBe("all");
    expect(sanitizeDismissedUpcoming(["i:2026-01-01:a", 1, "x"])).toEqual(["i:2026-01-01:a"]);
  });
});

describe("2.9.1 hideUpcomingFilter", () => {
  it("defaults off; true is kept", () => {
    expect(migrateSettings({ settingsVersion: 10 }).settings.hideUpcomingFilter).toBe(false);
    expect(
      migrateSettings({ settingsVersion: 10, hideUpcomingFilter: true }).settings
        .hideUpcomingFilter,
    ).toBe(true);
    expect(
      migrateSettings({ settingsVersion: 9, hideUpcomingFilter: "yes" as never }).settings
        .hideUpcomingFilter,
    ).toBe(false);
  });
});


describe("upcoming filter helpers", () => {
  test("resolveUpcomingFilter forces all when control is hidden", () => {
    expect(resolveUpcomingFilter("important", true)).toBe("all");
    expect(resolveUpcomingFilter("holidays", true)).toBe("all");
    expect(resolveUpcomingFilter("all", true)).toBe("all");
  });

  test("resolveUpcomingFilter keeps saved value when control is shown", () => {
    expect(resolveUpcomingFilter("important", false)).toBe("important");
    expect(resolveUpcomingFilter("holidays", false)).toBe("holidays");
    expect(resolveUpcomingFilter("all", false)).toBe("all");
    expect(resolveUpcomingFilter("bogus", false)).toBe("all");
  });

  test("upcomingFilterLabelKey maps each filter to an i18n key", () => {
    expect(upcomingFilterLabelKey("all")).toBe("upcoming.filterAll");
    expect(upcomingFilterLabelKey("holidays")).toBe("upcoming.filterHolidays");
    expect(upcomingFilterLabelKey("important")).toBe("upcoming.filterImportant");
  });
});
