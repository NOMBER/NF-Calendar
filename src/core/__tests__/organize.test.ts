import moment from "moment";

import { getDateUID, parseNoteDate } from "../dates";
import {
  isInYearFolder,
  newDailyNotePath,
  notePathCandidates,
  periodMonth,
  planOrganize,
  planUndo,
  preferNotePath,
} from "../organize";

describe("organize by year: plan", () => {
  const files = [
    "Daily/2025-12-31.md",
    "Daily/2026-01-01.md",
    "Daily/2026-02-30.md", // invalid date
    "Daily/notes.md",
    "Daily/2026-03-01.png", // not md
    "Daily/2024/2024-05-05.md", // already in a year folder
    "Daily/2026-04-04.md", // conflict below
    "Other/2026-01-02.md", // outside the folder
    ".obsidian/2026-01-03.md",
  ];
  const existing = [...files, "Daily/2026/2026-04-04.md", "Daily/2024"];

  const plan = planOrganize(moment, files, existing, "Daily", "YYYY-MM-DD");

  it("moves only recognized md files directly in the folder", () => {
    expect(plan.moves).toEqual([
      { from: "Daily/2025-12-31.md", to: "Daily/2025/2025-12-31.md", year: "2025" },
      { from: "Daily/2026-01-01.md", to: "Daily/2026/2026-01-01.md", year: "2026" },
    ]);
    expect(plan.byYear).toEqual({ "2025": 1, "2026": 1 });
  });

  it("reports skips with reasons", () => {
    const by = (r: string) => plan.skipped.filter((s) => s.reason === r).map((s) => s.path);
    expect(by("unparsed")).toEqual(["Daily/2026-02-30.md", "Daily/notes.md"]);
    expect(by("conflict")).toEqual(["Daily/2026-04-04.md"]);
    expect(by("already")).toEqual(["Daily/2024/2024-05-05.md"]);
    expect(by("inSubfolder")).toEqual([]);
  });

  it("never touches config dir, non-md or other folders", () => {
    const all = [...plan.moves.map((m) => m.from), ...plan.skipped.map((s) => s.path)];
    expect(
      all.some((p) => p.startsWith(".obsidian") || p.endsWith(".png") || p.startsWith("Other")),
    ).toBe(false);
  });

  it("conflicts are case-insensitive and between planned moves", () => {
    const p = planOrganize(
      moment,
      ["D/2026-01-01.md"],
      ["D/2026/2026-01-01.MD"],
      "D",
      "YYYY-MM-DD",
    );
    expect(p.moves).toHaveLength(0);
    expect(p.skipped[0].reason).toBe("conflict");
  });

  it("root folder and other formats", () => {
    const p = planOrganize(moment, ["30.10.2026.md"], [], "", "DD.MM.YYYY");
    expect(p.moves[0].to).toBe("2026/30.10.2026.md");
  });

  it("format with folders is skipped", () => {
    const p = planOrganize(moment, ["D/2026-01-01.md"], [], "D", "YYYY/YYYY-MM-DD");
    expect(p.moves).toHaveLength(0);
  });
});

describe("path resolution for flat / year / mixed layouts", () => {
  it("expected path first, then the other layouts", () => {
    expect(notePathCandidates("Daily", "2026-10-30", "2026", false)).toEqual([
      "Daily/2026-10-30.md",
      "Daily/2026/2026-10-30.md",
      "Daily/2026/01/2026-10-30.md",
    ]);
    expect(notePathCandidates("Daily", "2026-10-30", "2026", true)).toEqual([
      "Daily/2026/2026-10-30.md",
      "Daily/2026-10-30.md",
      "Daily/2026/01/2026-10-30.md",
    ]);
    expect(notePathCandidates("Daily", "2026-10-30", "2026", "year-month", undefined, "10")).toEqual([
      "Daily/2026/10/2026-10-30.md",
      "Daily/2026/2026-10-30.md",
      "Daily/2026-10-30.md",
    ]);
    expect(notePathCandidates("", "2026-10-30", "2026", true)[0]).toBe("2026/2026-10-30.md");
  });

  it("format with folders keeps a single path", () => {
    expect(notePathCandidates("D", "2026/10/2026-10-30", "2026", true)).toEqual([
      "D/2026/10/2026-10-30.md",
    ]);
  });

  it("notes in any year folder are recognized by date (mixed layout index)", () => {
    for (const rel of ["2026-10-30", "2026/2026-10-30", "2025/2026-10-30"]) {
      const d = parseNoteDate(moment, rel, "YYYY-MM-DD", "day");
      expect(d && getDateUID(d)).toBe(getDateUID(moment("2026-10-30")));
    }
    expect(isInYearFolder("Daily/2026/2026-10-30.md", "Daily")).toBe(true);
    expect(isInYearFolder("Daily/2026-10-30.md", "Daily")).toBe(false);
  });
});

describe("undo", () => {
  it("reverses only where target still exists and source is free", () => {
    const moves = [
      { from: "D/a.md", to: "D/2026/a.md", year: "2026" },
      { from: "D/b.md", to: "D/2026/b.md", year: "2026" },
    ];
    const exists = new Set(["D/2026/a.md", "D/b.md", "D/2026/b.md"]);
    const r = planUndo(moves, (p) => exists.has(p));
    expect(r.undo).toEqual([{ from: "D/2026/a.md", to: "D/a.md", year: "2026" }]);
    expect(r.skipped).toHaveLength(1);
  });
});

describe("duplicates after organize (2.4.1 regression)", () => {
  const year = notePathCandidates("Diaries/Daily Diary", "2026-11-05", "2026", true);
  it("year-folder note wins over a flat duplicate, in any listing order", () => {
    const a = "Diaries/Daily Diary/2026/2026-11-05.md";
    const b = "Diaries/Daily Diary/2026-11-05.md";
    expect(preferNotePath(a, b, year)).toBe(a);
    expect(preferNotePath(b, a, year)).toBe(a);
  });
  it("flat wins when year folders are off; unknown places lose", () => {
    const flat = notePathCandidates("D", "2026-11-05", "2026", false);
    expect(preferNotePath("D/2026/2026-11-05.md", "D/2026-11-05.md", flat)).toBe("D/2026-11-05.md");
    expect(preferNotePath("D/x/2026-11-05.md", "D/2026/2026-11-05.md", flat)).toBe(
      "D/2026/2026-11-05.md",
    );
  });
});

describe("organize by year-month", () => {
  it("moves flat and year notes into YYYY/MM", () => {
    const files = [
      "Daily/2026-11-05.md",
      "Daily/2026/2026-01-02.md",
      "Daily/2025/12/2025-12-01.md", // already at year-month
    ];
    const existing = [...files];
    const plan = planOrganize(moment, files, existing, "Daily", "YYYY-MM-DD", "year-month");
    expect(plan.moves).toEqual([
      { from: "Daily/2026-11-05.md", to: "Daily/2026/11/2026-11-05.md", year: "2026", month: "11" },
      { from: "Daily/2026/2026-01-02.md", to: "Daily/2026/01/2026-01-02.md", year: "2026", month: "01" },
    ]);
    expect(plan.skipped.filter((s) => s.reason === "already").map((s) => s.path)).toEqual([
      "Daily/2025/12/2025-12-01.md",
    ]);
  });
});

describe("reverse organize: year-month → year, any → flat", () => {
  it("year-month down to year leaves empty month folders", () => {
    const files = ["Daily/2026/11/2026-11-05.md", "Daily/2027/01/2027-01-01.md"];
    const plan = planOrganize(moment, files, files, "Daily", "YYYY-MM-DD", "year");
    expect(plan.moves).toEqual([
      {
        from: "Daily/2026/11/2026-11-05.md",
        to: "Daily/2026/2026-11-05.md",
        year: "2026",
        month: "11",
      },
      {
        from: "Daily/2027/01/2027-01-01.md",
        to: "Daily/2027/2027-01-01.md",
        year: "2027",
        month: "01",
      },
    ]);
    expect(plan.emptyFolders).toEqual(
      expect.arrayContaining(["Daily/2026/11", "Daily/2027/01"]),
    );
  });

  it("any structure → flat", () => {
    const files = [
      "Daily/2026-11-05.md",
      "Daily/2026/2026-01-02.md",
      "Daily/2027/01/2027-01-01.md",
    ];
    const plan = planOrganize(moment, files, files, "Daily", "YYYY-MM-DD", "flat");
    expect(plan.moves.map((m) => m.to).sort()).toEqual([
      "Daily/2026-01-02.md",
      "Daily/2027-01-01.md",
    ]);
    expect(plan.skipped.filter((s) => s.reason === "already").map((s) => s.path)).toEqual([
      "Daily/2026-11-05.md",
    ]);
    expect(plan.emptyFolders).toEqual(
      expect.arrayContaining(["Daily/2026", "Daily/2027/01", "Daily/2027"]),
    );
  });
});

describe("newDailyNotePath / year & month boundaries", () => {
  it("flat / year / year-month for mid-year", () => {
    const d = moment("2026-11-05");
    expect(newDailyNotePath("Daily", "2026-11-05.md", d, "flat")).toBe("Daily/2026-11-05.md");
    expect(newDailyNotePath("Daily", "2026-11-05.md", d, "year")).toBe("Daily/2026/2026-11-05.md");
    expect(newDailyNotePath("Daily", "2026-11-05.md", d, "year-month")).toBe(
      "Daily/2026/11/2026-11-05.md",
    );
  });

  it("new year lands in year/month folder under year-month layout", () => {
    const d = moment("2027-01-01");
    expect(periodMonth(d)).toBe("01");
    expect(newDailyNotePath("Daily", "2027-01-01.md", d, "year-month")).toBe(
      "Daily/2027/01/2027-01-01.md",
    );
    expect(newDailyNotePath("Daily", "2027-01-01.md", d, "year")).toBe("Daily/2027/2027-01-01.md");
  });

  it("new month under year-month", () => {
    const d = moment("2026-12-01");
    expect(newDailyNotePath("", "2026-12-01.md", d, "year-month")).toBe("2026/12/2026-12-01.md");
  });
});
