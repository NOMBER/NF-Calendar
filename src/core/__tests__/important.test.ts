import moment from "moment";

import { allImportantDays, clampPrepDays, getDayMarks, upcomingImportantDays } from "../important";
import type { ImportantDays } from "../important";

const d = (s: string) => moment(s, "YYYY-MM-DD");

const days: ImportantDays = {
  "2026-11-10": { title: "Exam", color: "red", prepDays: 3 },
  "2026-11-12": { title: "Trip", color: "blue", prepDays: 5 },
  "2026-12-31": { title: "", color: "green", prepDays: 0 },
};

describe("preparation window", () => {
  it("marks the important day itself", () => {
    expect(getDayMarks(moment, d("2026-11-10"), days).important?.title).toBe("Exam");
  });

  it("highlights exactly N days before, nearest first", () => {
    expect(getDayMarks(moment, d("2026-11-06"), days).preparingFor).toHaveLength(0);
    const m = getDayMarks(moment, d("2026-11-07"), days).preparingFor;
    expect(m.map((p) => [p.date, p.daysLeft])).toEqual([
      ["2026-11-10", 3],
      ["2026-11-12", 5],
    ]);
    expect(getDayMarks(moment, d("2026-11-11"), days).preparingFor.map((p) => p.date)).toEqual(["2026-11-12"]);
  });

  it("prepDays 0 means no window; clamped to 0..30", () => {
    expect(getDayMarks(moment, d("2026-12-30"), days).preparingFor).toHaveLength(0);
    expect(clampPrepDays(-3)).toBe(0);
    expect(clampPrepDays(99)).toBe(30);
    expect(clampPrepDays(Number.NaN)).toBe(0);
  });
});

describe("upcoming list", () => {
  it("includes today, respects the horizon, sorted", () => {
    const list = upcomingImportantDays(moment, d("2026-11-10"), days, 30);
    expect(list.map((x) => [x.date, x.daysLeft])).toEqual([
      ["2026-11-10", 0],
      ["2026-11-12", 2],
    ]);
    expect(upcomingImportantDays(moment, d("2026-11-11"), days, 60).map((x) => x.date)).toEqual([
      "2026-11-12",
      "2026-12-31",
    ]);
  });

  it("all days sorted by date", () => {
    expect(allImportantDays(days).map((x) => x.date)).toEqual(["2026-11-10", "2026-11-12", "2026-12-31"]);
  });
});
