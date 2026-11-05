import { customColorCss, sanitizeImportantColor } from "../important";
/** Path sanitising, data.json validation and regex safety (see docs/ARCHITECTURE.md). */
import moment from "moment";

import { buildNotePath, isSafeVaultPath, sanitizeVaultPath } from "../paths";
import { trimTrailingBlankLines } from "../merge";
import { applyTemplate } from "../placeholders";
import { sanitizeCondition } from "../rules";
import {
  LIMITS,
  migrateSettings,
  sanitizeImportant,
  sanitizeLocale,
  sanitizeRules,
  sanitizeWeekStart,
} from "../settings";

beforeAll(() => moment.locale("en"));

describe("sanitizeVaultPath", () => {
  it.each([
    ["../outside", null],
    ["Daily/../../etc/passwd", null],
    ["Daily\\..\\..\\x", null],
    ["Daily/.../x", null],
    ["Daily/. ./x", null],
    ["C:/Windows/x", null],
    ["c:relative", null],
    ["~/notes", null],
    [".obsidian/plugins/x", null],
    ["/.OBSIDIAN/x", null],
    ["Daily/\u0000x", null],
    ["Daily/\nx", null],
    ["a".repeat(513), null],
  ])("rejects %j", (input, expected) => {
    expect(sanitizeVaultPath(input)).toBe(expected);
  });

  it.each([
    ["Daily/2026-10-30.md", "Daily/2026-10-30.md"],
    ["/Daily//2026/./x.md", "Daily/2026/x.md"],
    ["Daily\\Sub\\x.md", "Daily/Sub/x.md"],
    ["  Journal/x.md ", "Journal/x.md"],
    [".hidden-but-not-config/x.md", ".hidden-but-not-config/x.md"],
    ["Notes/..dots in name.md", "Notes/..dots in name.md"],
    ["", ""],
  ])("keeps %j", (input, expected) => {
    expect(sanitizeVaultPath(input)).toBe(expected);
  });

  it("respects a custom config dir", () => {
    expect(sanitizeVaultPath(".config/x.md", ".config")).toBeNull();
    expect(sanitizeVaultPath(".obsidian/x.md", ".config")).toBe(".obsidian/x.md");
  });

  it("ignores non-strings", () => {
    expect(sanitizeVaultPath(42 as unknown as string)).toBeNull();
  });
});

describe("buildNotePath", () => {
  it("builds normal paths", () => {
    expect(buildNotePath("Daily/", "2026-10-30")).toBe("Daily/2026-10-30.md");
    expect(buildNotePath("", "2026/10/30")).toBe("2026/10/30.md");
  });

  it("rejects traversal coming from the folder or the date format", () => {
    expect(buildNotePath("..", "x")).toBeNull();
    expect(buildNotePath("Daily", "../../x")).toBeNull();
    // a format like "[../]YYYY" renders to "../2026"
    expect(buildNotePath("Daily", moment("2026-10-30").format("[../]YYYY"))).toBeNull();
    expect(buildNotePath(".obsidian", "x")).toBeNull();
  });

  it("rejects an empty file name", () => {
    expect(buildNotePath("Daily", "")).toBeNull();
    expect(buildNotePath("", "")).toBeNull();
  });

  it("isSafeVaultPath treats empty as safe (vault root / no template)", () => {
    expect(isSafeVaultPath("")).toBe(true);
    expect(isSafeVaultPath("Templates/Daily")).toBe(true);
    expect(isSafeVaultPath("../Templates")).toBe(false);
  });
});

describe("settings validation (data.json)", () => {
  it("weekStart / locale accept only known values", () => {
    expect(sanitizeWeekStart("monday")).toBe("monday");
    expect(sanitizeWeekStart("funday")).toBe("locale");
    expect(sanitizeWeekStart({})).toBe("locale");
    expect(sanitizeLocale("en-gb")).toBe("en-gb");
    expect(sanitizeLocale("ru")).toBe("ru");
    expect(sanitizeLocale("../../../etc")).toBe("system-default");
    expect(sanitizeLocale("x".repeat(100))).toBe("system-default");
    expect(sanitizeLocale(5)).toBe("system-default");
  });

  it("important colour: presets or strict #rrggbb only", () => {
    expect(sanitizeImportantColor("blue")).toBe("blue");
    expect(sanitizeImportantColor("#A1b2C3")).toBe("#a1b2c3");
    for (const bad of ["#abc", "#12345g", "red;}", '#123456"]{', "url(x)", 5, null]) {
      expect(sanitizeImportantColor(bad)).toBe("red");
    }
  });

  it("custom colour CSS only contains validated hex", () => {
    const css = customColorCss({
      "2026-01-01": { color: "#ff0000", prepDays: 0, events: [{ id: "e", title: "a" }] },
      "2026-01-02": {
        color: '#00ff00"]{}body{x' as never,
        prepDays: 0,
        events: [{ id: "e", title: "b" }],
      },
      "2026-01-03": { color: "blue", prepDays: 0, events: [{ id: "e", title: "c" }] },
    });
    expect(css).toContain('[data-cwt-important="#ff0000"]');
    expect(css).toContain("--cwt-c-rgb: 255, 0, 0");
    expect(css).not.toContain("body");
    expect(css.split("\n")).toHaveLength(1);
  });

  it("old wordsPerDot is dropped on migration", () => {
    const { settings } = migrateSettings({ settingsVersion: 3, wordsPerDot: 99 });
    expect("wordsPerDot" in settings).toBe(false);
    expect(settings.dotsMode).toBe("exists");
    expect(settings.settingsVersion).toBe(12);
  });

  it("conditions: unknown types and wrong field types are dropped", () => {
    expect(sanitizeCondition({ type: "eval", code: "x" })).toBeNull();
    expect(sanitizeCondition("date")).toBeNull();
    expect(sanitizeCondition({ type: "date", date: 5 })).toEqual({ type: "date", date: "" });
    expect(sanitizeCondition({ type: "date", date: "2026-10-30-and-more" })).toEqual({
      type: "date",
      date: "2026-10-30",
    });
    expect(sanitizeCondition({ type: "nthWeekday", nth: "1", weekday: 2.5 })).toEqual({
      type: "nthWeekday",
      nth: 1,
      weekday: 1,
    });
    expect(sanitizeCondition({ type: "weekParity", parity: "both" })).toEqual({
      type: "weekParity",
      parity: "even",
    });
  });

  it("rules are limited and cleaned", () => {
    const many = Array.from({ length: LIMITS.rules + 50 }, (_, i) => ({
      id: `r${i}`,
      condition: { type: "date", date: "2026-10-30" },
      template: "T",
      appliesTo: ["day", "year", "__proto__"],
    }));
    const rules = sanitizeRules(many);
    expect(rules).toHaveLength(LIMITS.rules);
    expect(rules[0].appliesTo).toEqual(["day"]);
    expect(sanitizeRules({ length: 3 })).toEqual([]);
    expect(sanitizeRules([null, 1, { condition: { type: "nope" } }])).toEqual([]);
  });

  it("important days: only date keys, known colours, capped text", () => {
    const out = sanitizeImportant({
      "2026-10-30": { title: "x".repeat(1000), color: "javascript:alert(1)", prepDays: 999 },
      "../../x": { title: "bad" },
      __proto__: { title: "bad" },
    });
    expect(Object.keys(out)).toEqual(["2026-10-30"]);
    expect(out["2026-10-30"].events[0].title).toHaveLength(LIMITS.text);
    expect(out["2026-10-30"].color).toBe("red");
    expect(sanitizeImportant([{ title: "x" }])).toEqual({});
  });

  it("migrateSettings strips control characters and caps lengths", () => {
    const { settings } = migrateSettings({
      settingsVersion: 2,
      daily: { enabled: true, folder: "Daily\u0000\n", format: "Y".repeat(1000), template: 7 },
      weekStart: "x",
      localeOverride: "../x",
      upcomingHorizonDays: 1e9,
    });
    expect(settings.daily.folder).toBe("Daily");
    expect(settings.daily.format).toHaveLength(LIMITS.format);
    expect(settings.daily.template).toBe("");
    expect(settings.weekStart).toBe("locale");
    expect(settings.localeOverride).toBe("system-default");
    expect(settings.upcomingHorizonDays).toBe(365);
  });
});

describe("regex safety (ReDoS) and template injection", () => {
  const date = moment("2026-10-30", "YYYY-MM-DD");

  it("placeholders stay fast on hostile input", () => {
    const hostile = [
      "{{date" + " ".repeat(50000),
      "{{" + "date+1d:".repeat(20000),
      "{{monday:" + "{".repeat(50000),
      "{{carryover" + " ".repeat(50000),
    ];
    for (const text of hostile) {
      const started = Date.now();
      applyTemplate(text, date, "YYYY-MM-DD", date, { carryover: "x" });
      expect(Date.now() - started).toBeLessThan(500);
    }
  });

  it("replacement patterns ($&, $1, $`) in values are inserted literally", () => {
    expect(
      applyTemplate("{{carryover}}", date, "YYYY-MM-DD", date, { carryover: "$& $1 $`" }),
    ).toBe("$& $1 $`");
    expect(applyTemplate("{{date}}", date, "[$&]YYYY", date)).toBe("$&2026");
  });

  it("carried-over text is not expanded again", () => {
    expect(
      applyTemplate("{{carryover}}", date, "YYYY-MM-DD", date, { carryover: "- [ ] {{date}}" }),
    ).toBe("- [ ] {{date}}");
  });

  it("trimming trailing blank lines is linear", () => {
    const text = "a" + " \n".repeat(100000) + "b" + "\n \t".repeat(100000);
    const started = Date.now();
    expect(trimTrailingBlankLines(text).endsWith("b")).toBe(true);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
