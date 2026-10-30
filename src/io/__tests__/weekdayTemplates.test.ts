import moment from "moment";

import {
  applyDailyTemplate,
  buildNotePath,
  orderedWeekdays,
  parentFolders,
  selectDailyTemplate,
  EMPTY_WEEKDAY_TEMPLATES,
} from "../weekdayTemplates";

const templates = {
  ...EMPTY_WEEKDAY_TEMPLATES,
  monday: "Templates/Monday.md",
  friday: "  Templates/Friday  ",
};

describe("selectDailyTemplate", () => {
  beforeAll(() => moment.locale("en"));

  it("uses the weekday of the NOTE date, not today", () => {
    // 2026-11-02 is a Monday; 2026-11-06 is a Friday.
    const monday = moment("2026-11-02", "YYYY-MM-DD");
    const friday = moment("2026-11-06", "YYYY-MM-DD");
    const s = { useWeekdayTemplates: true, weekdayTemplates: templates };

    expect(selectDailyTemplate(monday, s, "Templates/Daily")).toEqual({
      path: "Templates/Monday.md",
      source: "weekday",
      weekday: "monday",
    });
    expect(selectDailyTemplate(friday, s, "Templates/Daily").path).toBe(
      "Templates/Friday"
    );
  });

  it("falls back to the default template when the weekday field is empty", () => {
    const tuesday = moment("2026-11-03", "YYYY-MM-DD");
    const s = { useWeekdayTemplates: true, weekdayTemplates: templates };
    expect(selectDailyTemplate(tuesday, s, "Templates/Daily")).toEqual({
      path: "Templates/Daily",
      source: "fallback",
      weekday: "tuesday",
    });
  });

  it("ignores weekday templates when the toggle is off", () => {
    const monday = moment("2026-11-02", "YYYY-MM-DD");
    const s = { useWeekdayTemplates: false, weekdayTemplates: templates };
    expect(selectDailyTemplate(monday, s, "Templates/Daily").source).toBe(
      "fallback"
    );
  });

  it("returns 'none' when nothing is configured", () => {
    const sunday = moment("2026-11-01", "YYYY-MM-DD");
    const s = { useWeekdayTemplates: true, weekdayTemplates: {} };
    expect(selectDailyTemplate(sunday, s, "")).toEqual({
      path: "",
      source: "none",
      weekday: "sunday",
    });
  });
});

describe("applyDailyTemplate", () => {
  beforeAll(() => moment.locale("en"));
  const noteDate = moment("2026-11-04", "YYYY-MM-DD"); // Wednesday
  const now = moment("2026-10-30 08:15:00", "YYYY-MM-DD HH:mm:ss");

  it("replaces core placeholders relative to the note date", () => {
    const tpl = [
      "# {{title}}",
      "date={{date}}",
      "time={{time}}",
      "long={{date:dddd, D MMMM YYYY}}",
      "t={{time:HH:mm:ss}}",
      "y={{yesterday}} t={{tomorrow}}",
      "plus={{date+1w:YYYY-MM-DD}} minus={{date-1d}}",
      "{{ DATE }}",
    ].join("\n");
    const out = applyDailyTemplate(tpl, noteDate, "YYYY-MM-DD", now);
    expect(out).toBe(
      [
        "# 2026-11-04",
        "date=2026-11-04",
        "time=08:15",
        "long=Wednesday, 4 November 2026",
        "t=08:15:00",
        "y=2026-11-03 t=2026-11-05",
        "plus=2026-11-11 minus=2026-11-03",
        "2026-11-04",
      ].join("\n")
    );
  });

  it("resolves weekday tags inside the note's week (Monday-first locale)", () => {
    moment.updateLocale("en-gb-test", { parentLocale: "en", week: { dow: 1, doy: 4 } });
    const d = moment("2026-11-08", "YYYY-MM-DD").locale("en-gb-test"); // Sunday
    const out = applyDailyTemplate(
      "{{monday:YYYY-MM-DD}} {{sunday:YYYY-MM-DD}}",
      d,
      "YYYY-MM-DD",
      now
    );
    expect(out).toBe("2026-11-02 2026-11-08");
  });

  it("resolves weekday tags inside the note's week (Sunday-first locale)", () => {
    const d = moment("2026-11-08", "YYYY-MM-DD").locale("en"); // Sunday
    const out = applyDailyTemplate(
      "{{monday:YYYY-MM-DD}} {{sunday:YYYY-MM-DD}}",
      d,
      "YYYY-MM-DD",
      now
    );
    expect(out).toBe("2026-11-09 2026-11-08");
  });

  it("leaves Templater syntax and unknown tags untouched", () => {
    const tpl =
      '<% tp.date.now("YYYY-MM-DD") %> <%* tR += "x" %> {{unknown}} {{date}}';
    const out = applyDailyTemplate(tpl, noteDate, "YYYY-MM-DD", now);
    expect(out).toBe(
      '<% tp.date.now("YYYY-MM-DD") %> <%* tR += "x" %> {{unknown}} 2026-11-04'
    );
  });

  it("does not mutate the input date", () => {
    const d = moment("2026-11-04", "YYYY-MM-DD");
    applyDailyTemplate("{{tomorrow}} {{monday:YYYY}} {{date+3d}}", d, "YYYY-MM-DD", now);
    expect(d.format("YYYY-MM-DD HH:mm")).toBe("2026-11-04 00:00");
  });
});

describe("helpers", () => {
  it("orders weekdays from the first day of week", () => {
    expect(orderedWeekdays(1)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]);
    expect(orderedWeekdays(0)[0]).toBe("sunday");
    expect(orderedWeekdays(6)[0]).toBe("saturday");
  });

  it("builds note paths and parent folders", () => {
    expect(buildNotePath("Daily/", "2026-11-04")).toBe("Daily/2026-11-04.md");
    expect(buildNotePath("", "2026/11/04")).toBe("2026/11/04.md");
    expect(buildNotePath("/Journal", "x.md")).toBe("Journal/x.md");
    expect(parentFolders("Journal/2026/11/04.md")).toEqual([
      "Journal",
      "Journal/2026",
      "Journal/2026/11",
    ]);
    expect(parentFolders("note.md")).toEqual([]);
  });
});
