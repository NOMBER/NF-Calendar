import {
  countTasks,
  countTasksFromListItems,
  currentStreak,
  extractOpenTasks,
  getWordCount,
  isAllTasksDone,
  MAX_CARRYOVER_TASKS,
  summarizeMonth,
} from "../stats";

describe("words", () => {
  it("counts latin and cyrillic words", () => {
    expect(getWordCount("Hello, world! Привет мир — 2026")).toBe(5);
    expect(getWordCount("")).toBe(0);
  });
});

describe("tasks", () => {
  it("counts done and open tasks of all list styles", () => {
    const text = [
      "- [x] done",
      "- [ ] open",
      "* [X] done 2",
      "  + [ ] nested open",
      "1. [x] numbered",
      "- not a task",
      "[ ] not a list item",
    ].join("\n");
    expect(countTasks(text)).toEqual({ done: 3, open: 2 });
  });

  it("ignores code blocks", () => {
    expect(countTasks("```\n- [ ] code\n```\n- [ ] real")).toEqual({ done: 0, open: 1 });
  });

  it("uses metadataCache list items", () => {
    expect(countTasksFromListItems([{ task: "x" }, { task: " " }, {}, { task: "X" }])).toEqual({
      done: 2,
      open: 1,
    });
    expect(countTasksFromListItems(undefined)).toEqual({ done: 0, open: 0 });
  });
});

describe("month summary", () => {
  it("totals and averages", () => {
    const days = [
      { date: "2026-10-01", hasNote: true, words: 100, tasksDone: 2, tasksOpen: 1 },
      { date: "2026-10-02", hasNote: false, words: 0, tasksDone: 0, tasksOpen: 0 },
      { date: "2026-10-03", hasNote: true, words: 50, tasksDone: 0, tasksOpen: 3 },
      { date: "2026-10-04", hasNote: false, words: 0, tasksDone: 0, tasksOpen: 0 },
    ];
    expect(summarizeMonth(days)).toMatchObject({
      totalWords: 150,
      daysWithNotes: 2,
      daysInMonth: 4,
      tasksDone: 2,
      tasksTotal: 6,
      avgWordsPerNote: 75,
    });
  });

  it("empty month", () => {
    expect(summarizeMonth([])).toMatchObject({
      totalWords: 0,
      avgWordsPerDay: 0,
      avgWordsPerNote: 0,
    });
  });
});

describe("✓ days and streak", () => {
  const day = (tasksDone: number, tasksOpen: number, hasNote = true) => ({
    date: "x",
    hasNote,
    words: 0,
    tasksDone,
    tasksOpen,
  });

  it("isAllTasksDone needs at least one task and no open ones", () => {
    expect(isAllTasksDone({ tasksDone: 2, tasksOpen: 0 })).toBe(true);
    expect(isAllTasksDone({ tasksDone: 2, tasksOpen: 1 })).toBe(false);
    expect(isAllTasksDone({ tasksDone: 0, tasksOpen: 0 })).toBe(false);
  });

  it("summarizeMonth counts ✓ days", () => {
    const sum = summarizeMonth([day(1, 0), day(3, 0), day(1, 1), day(0, 0), day(0, 0, false)]);
    expect(sum.allDoneDays).toBe(2);
  });

  it("currentStreak counts back from the anchor", () => {
    const done = [true, true, false, true]; // index = days ago
    expect(currentStreak((i) => done[i] ?? false)).toBe(2);
    expect(currentStreak(() => false)).toBe(0);
  });

  it("an unfinished today does not break the streak (pendingAnchor)", () => {
    const done = [false, true, true, true, false];
    expect(currentStreak((i) => done[i] ?? false)).toBe(0);
    expect(currentStreak((i) => done[i] ?? false, { pendingAnchor: true })).toBe(3);
  });

  it("currentStreak is bounded", () => {
    expect(currentStreak(() => true, { limit: 10 })).toBe(10);
    expect(currentStreak(() => true)).toBe(366);
  });
});

describe("extractOpenTasks ({{carryover}})", () => {
  it("returns open tasks only, keeps indentation, skips code", () => {
    const text = [
      "# Day",
      "- [ ] first",
      "- [x] done",
      "  - [ ] nested   ",
      "* [ ] star",
      "1. [ ] numbered",
      "- [ ]   ",
      "```",
      "- [ ] in code",
      "```",
      "- [-] cancelled",
      "text - [ ] not a task",
    ].join("\n");
    expect(extractOpenTasks(text)).toEqual([
      "- [ ] first",
      "  - [ ] nested",
      "* [ ] star",
      "1. [ ] numbered",
    ]);
  });

  it("escapes Templater tags and respects the limit", () => {
    expect(extractOpenTasks("- [ ] <% tp.system.exec() %>")).toEqual([
      "- [ ] <\\% tp.system.exec() %>",
    ]);
    const many = Array.from({ length: 500 }, (_, i) => `- [ ] t${i}`).join("\n");
    expect(extractOpenTasks(many)).toHaveLength(MAX_CARRYOVER_TASKS);
    expect(extractOpenTasks(many, 3)).toHaveLength(3);
    expect(extractOpenTasks("")).toEqual([]);
  });
});
