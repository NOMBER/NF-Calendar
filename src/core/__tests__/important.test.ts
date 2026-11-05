import moment from "moment";

import {
  allImportantDays,
  allImportantEvents,
  clampPrepDays,
  dayTitle,
  getDayMarks,
  holidayDismissKey,
  importantDismissKey,
  isDismissed,
  removeEventFromDay,
  upcomingImportantDays,
} from "../important";
import type { ImportantDays } from "../important";

const d = (s: string) => moment(s, "YYYY-MM-DD");

const days: ImportantDays = {
  "2026-11-10": {
    color: "red",
    prepDays: 3,
    events: [
      { id: "a", title: "Exam" },
      { id: "b", title: "Deadline" },
    ],
  },
  "2026-11-12": { color: "blue", prepDays: 5, events: [{ id: "c", title: "Trip" }] },
  "2026-12-31": { color: "green", prepDays: 0, events: [{ id: "d", title: "" }] },
};

describe("preparation window", () => {
  it("marks the important day itself", () => {
    expect(dayTitle(getDayMarks(moment, d("2026-11-10"), days).important)).toBe("Exam, Deadline");
  });

  it("highlights exactly N days before, nearest first", () => {
    expect(getDayMarks(moment, d("2026-11-06"), days).preparingFor).toHaveLength(0);
    const m = getDayMarks(moment, d("2026-11-07"), days).preparingFor;
    expect(m.map((p) => [p.date, p.daysLeft])).toEqual([
      ["2026-11-10", 3],
      ["2026-11-12", 5],
    ]);
    expect(getDayMarks(moment, d("2026-11-11"), days).preparingFor.map((p) => p.date)).toEqual([
      "2026-11-12",
    ]);
  });

  it("prepDays 0 means no window; clamped to 0..30", () => {
    expect(getDayMarks(moment, d("2026-12-30"), days).preparingFor).toHaveLength(0);
    expect(clampPrepDays(-3)).toBe(0);
    expect(clampPrepDays(99)).toBe(30);
    expect(clampPrepDays(Number.NaN)).toBe(0);
  });
});

describe("upcoming list", () => {
  it("includes today, one row per event, respects the horizon, sorted", () => {
    const list = upcomingImportantDays(moment, d("2026-11-10"), days, 30);
    expect(list.map((x) => [x.date, x.event.id, x.daysLeft])).toEqual([
      ["2026-11-10", "a", 0],
      ["2026-11-10", "b", 0],
      ["2026-11-12", "c", 2],
    ]);
    expect(upcomingImportantDays(moment, d("2026-11-11"), days, 60).map((x) => x.date)).toEqual([
      "2026-11-12",
      "2026-12-31",
    ]);
  });

  it("all days / events sorted by date", () => {
    expect(allImportantDays(days).map((x) => x.date)).toEqual([
      "2026-11-10",
      "2026-11-12",
      "2026-12-31",
    ]);
    expect(allImportantEvents(days).map((x) => x.event.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("multi-event helpers", () => {
  it("removes one event and drops the day when empty", () => {
    const day = days["2026-11-10"];
    const next = removeEventFromDay(day, "a");
    expect(next?.events.map((e) => e.id)).toEqual(["b"]);
    expect(removeEventFromDay(next!, "b")).toBeNull();
  });

  it("dismiss keys", () => {
    expect(importantDismissKey("2026-11-10", "a")).toBe("i:2026-11-10:a");
    expect(holidayDismissKey("2026-11-10", "H/x.md")).toBe("h:2026-11-10:H/x.md");
    expect(isDismissed(["i:2026-11-10:a"], "i:2026-11-10:a")).toBe(true);
    expect(isDismissed([], "i:2026-11-10:a")).toBe(false);
  });
});
