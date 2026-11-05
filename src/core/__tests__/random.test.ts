import {
  inScope,
  isBlankDailyNote,
  pickRandomDay,
  pickRandomNonEmptyDay,
  randomCandidates,
  shiftDay,
} from "../random";

const days = [
  "2025-12-31",
  "2026-01-15",
  "2026-01-15",
  "2026-02-01",
  "2026-10-30",
  "2026-11-05",
  "bad",
];
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe("random daily note", () => {
  it("scopes and dedupe", () => {
    expect(randomCandidates(days, { kind: "all" })).toEqual([
      "2025-12-31",
      "2026-01-15",
      "2026-02-01",
      "2026-10-30",
      "2026-11-05",
    ]);
    expect(randomCandidates(days, { kind: "year", year: 2025 })).toEqual(["2025-12-31"]);
    expect(randomCandidates(days, { kind: "month", year: 2026, month: 1 })).toEqual(["2026-01-15"]);
    expect(randomCandidates(days, { kind: "lastDays", days: 7, today: "2026-11-05" })).toEqual([
      "2026-10-30",
      "2026-11-05",
    ]);
    expect(randomCandidates(days, { kind: "lastDays", days: 6, today: "2026-11-05" })).toEqual([
      "2026-11-05",
    ]);
    expect(inScope("2026-11-06", { kind: "lastDays", days: 30, today: "2026-11-05" })).toBe(false);
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("picks with injected random, edges and empty", () => {
    expect(pickRandomDay(days, { kind: "all" }, { random: () => 0 })).toBe("2025-12-31");
    expect(pickRandomDay(days, { kind: "all" }, { random: () => 0.9999 })).toBe("2026-11-05");
    expect(pickRandomDay(days, { kind: "all" }, { random: () => 1 })).toBe("2026-11-05");
    expect(pickRandomDay(days, { kind: "year", year: 1999 })).toBeNull();
    expect(pickRandomDay([], { kind: "all" })).toBeNull();
  });

  it("does not repeat the last one unless it is the only one", () => {
    expect(pickRandomDay(days, { kind: "all" }, { random: () => 0, exclude: "2025-12-31" })).toBe(
      "2026-01-15",
    );
    expect(pickRandomDay(days, { kind: "year", year: 2025 }, { exclude: "2025-12-31" })).toBe(
      "2025-12-31",
    );
  });

  it("skip empty: reads lazily, only drawn candidates", async () => {
    const read: string[] = [];
    const empty = new Set(["2025-12-31", "2026-01-15"]);
    const r = await pickRandomNonEmptyDay(
      days,
      { kind: "all" },
      async (d) => (read.push(d), empty.has(d)),
      { random: seq(0, 0, 0) },
    );
    expect(r).not.toBeNull();
    expect(empty.has(r as string)).toBe(false);
    expect(read.length).toBeLessThanOrEqual(3);
    expect(new Set(read).size).toBe(read.length);
    const none = await pickRandomNonEmptyDay(days, { kind: "year", year: 2026 }, async () => true);
    expect(none).toBeNull();
    const onlyExcluded = await pickRandomNonEmptyDay(
      ["2026-01-01", "2026-01-02"],
      { kind: "all" },
      async (d) => d === "2026-01-02",
      { exclude: "2026-01-01" },
    );
    expect(onlyExcluded).toBe("2026-01-01");
  });

  it("blank = template skeleton only", () => {
    expect(isBlankDailyNote("")).toBe(true);
    expect(
      isBlankDailyNote("---\ntags: daily\n---\n# 2026-11-05\n\n## Tasks\n- [ ]\n- \n---\n"),
    ).toBe(true);
    expect(isBlankDailyNote("# Day\n- [ ] buy milk")).toBe(false);
    expect(isBlankDailyNote("# Day\nsome text")).toBe(false);
    expect(isBlankDailyNote("---\ntitle: x\n---\nhello")).toBe(false);
  });
});

import { defaultRandomPrefs, sanitizeRandomPrefs, scopeFromPrefs } from "src/core/random";

describe("2.7.0 random range and prefs", () => {
  it("range is inclusive and order-insensitive", () => {
    const s = { kind: "range" as const, from: "2027-03-10", to: "2027-03-01" };
    expect(inScope("2027-03-01", s)).toBe(true);
    expect(inScope("2027-03-10", s)).toBe(true);
    expect(inScope("2027-03-11", s)).toBe(false);
    expect(randomCandidates(["2027-02-28", "2027-03-05", "x"], s)).toEqual(["2027-03-05"]);
  });

  it("scopeFromPrefs maps every kind", () => {
    const p = defaultRandomPrefs();
    expect(scopeFromPrefs(p, "2027-05-05", 2027, 5)).toEqual({ kind: "all" });
    expect(scopeFromPrefs({ ...p, kind: "year" }, "2027-05-05", 2026, 1)).toEqual({
      kind: "year",
      year: 2026,
    });
    expect(scopeFromPrefs({ ...p, kind: "month" }, "t", 2027, 2)).toEqual({
      kind: "month",
      year: 2027,
      month: 2,
    });
    expect(scopeFromPrefs({ ...p, kind: "lastDays", days: 7 }, "2027-05-05", 0, 0)).toEqual({
      kind: "lastDays",
      days: 7,
      today: "2027-05-05",
    });
    expect(scopeFromPrefs({ ...p, kind: "range" }, "t", 0, 0)).toEqual({ kind: "all" });
    const open = scopeFromPrefs({ ...p, kind: "range", from: "2027-01-01" }, "t", 0, 0);
    expect(inScope("2999-01-01", open)).toBe(true);
    expect(inScope("2026-12-31", open)).toBe(false);
  });

  it("sanitizeRandomPrefs rejects junk", () => {
    expect(sanitizeRandomPrefs(null)).toEqual(defaultRandomPrefs());
    expect(
      sanitizeRandomPrefs({
        kind: "zzz",
        days: 0,
        from: "2027-13",
        to: "2027-01-02",
        skipEmpty: "yes",
      }),
    ).toEqual({ kind: "all", days: 30, from: "", to: "2027-01-02", skipEmpty: false });
    expect(sanitizeRandomPrefs({ kind: "range", days: 99999999, skipEmpty: true }).skipEmpty).toBe(
      true,
    );
  });
});
