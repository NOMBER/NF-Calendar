import moment from "moment";

import {
  adjacentDate,
  datesBetween,
  datesForMonthFrom,
  datesUntilEndOf,
  getDateUID,
  getNoteForDate,
  missingDates,
  parseNoteDate,
} from "../dates";
import { buildNotePath, parentFolders, relativeNotePath } from "../paths";

const d = (s: string) => moment(s, "YYYY-MM-DD");
const fmt = (ds: moment.Moment[]) => ds.map((x) => x.format("YYYY-MM-DD"));

beforeAll(() => {
  moment.locale("en");
  moment.updateLocale("en", { week: { dow: 1, doy: 4 } }); // Monday first
});
afterAll(() => moment.updateLocale("en", { week: { dow: 0, doy: 6 } }));

describe("missing dates", () => {
  it("until end of week starts today", () => {
    expect(fmt(datesUntilEndOf(d("2026-10-29"), "week"))).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("until end of month", () => {
    expect(fmt(datesUntilEndOf(d("2026-10-29"), "month"))).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(datesUntilEndOf(d("2026-02-01"), "month")).toHaveLength(28);
  });

  it("displayed month: from today or from the first day, never the past", () => {
    expect(datesForMonthFrom(d("2026-10-30"), d("2026-11-15"))).toHaveLength(30);
    expect(fmt(datesForMonthFrom(d("2026-10-30"), d("2026-10-01")))).toEqual([
      "2026-10-30",
      "2026-10-31",
    ]);
    expect(datesForMonthFrom(d("2026-10-30"), d("2026-09-01"))).toHaveLength(0);
  });

  it("existing notes are skipped", () => {
    const existing = new Set(["2026-10-30"]);
    const dates = datesBetween(d("2026-10-29"), d("2026-10-31"));
    expect(fmt(missingDates(dates, (x) => existing.has(x.format("YYYY-MM-DD"))))).toEqual([
      "2026-10-29",
      "2026-10-31",
    ]);
  });
});

describe("note lookup and parsing", () => {
  it("getNoteForDate uses period UIDs", () => {
    const index = { [getDateUID(d("2026-10-26"), "week")]: "W44" };
    expect(getNoteForDate(d("2026-10-30"), index, "week")).toBe("W44");
    expect(getNoteForDate(d("2026-11-02"), index, "week")).toBeNull();
  });

  it("parses daily names, nested formats and rejects others", () => {
    expect(parseNoteDate(moment, "2026-10-30", "YYYY-MM-DD", "day")?.format("YYYY-MM-DD")).toBe(
      "2026-10-30",
    );
    expect(
      parseNoteDate(moment, "2026/10/2026-10-30", "YYYY/MM/YYYY-MM-DD", "day")?.format(
        "YYYY-MM-DD",
      ),
    ).toBe("2026-10-30");
    expect(parseNoteDate(moment, "Shopping list", "YYYY-MM-DD", "day")).toBeNull();
  });

  it("parses weekly and monthly names", () => {
    expect(parseNoteDate(moment, "2026-W44", "gggg-[W]ww", "week")?.format("YYYY-MM-DD")).toBe(
      "2026-10-26",
    );
    expect(parseNoteDate(moment, "2026-10", "YYYY-MM", "month")?.format("YYYY-MM-DD")).toBe(
      "2026-10-01",
    );
  });

  it("paths", () => {
    expect(buildNotePath("Daily/", "2026-10-30")).toBe("Daily/2026-10-30.md");
    expect(buildNotePath("", "2026/10/30")).toBe("2026/10/30.md");
    expect(parentFolders("A/B/c.md")).toEqual(["A", "A/B"]);
    expect(relativeNotePath("Daily/2026-10-30.md", "Daily")).toBe("2026-10-30");
    expect(relativeNotePath("Other/2026-10-30.md", "Daily")).toBeNull();
    expect(relativeNotePath("2026-10-30.md", "")).toBe("2026-10-30");
  });
});

describe("adjacentDate", () => {
  const d = (s: string) => moment(s, "YYYY-MM-DD");
  const dates = ["2026-10-20", "2026-10-28", "2026-10-31", "2026-11-05"].map(d);

  it("finds the nearest existing date before / after", () => {
    expect(adjacentDate(dates, d("2026-10-30"), -1)?.format("YYYY-MM-DD")).toBe("2026-10-28");
    expect(adjacentDate(dates, d("2026-10-30"), 1)?.format("YYYY-MM-DD")).toBe("2026-10-31");
    expect(adjacentDate(dates, d("2026-10-28"), -1)?.format("YYYY-MM-DD")).toBe("2026-10-20");
  });

  it("returns null at the ends", () => {
    expect(adjacentDate(dates, d("2026-10-20"), -1)).toBeNull();
    expect(adjacentDate(dates, d("2026-11-05"), 1)).toBeNull();
    expect(adjacentDate([], d("2026-11-05"), 1)).toBeNull();
  });
});
