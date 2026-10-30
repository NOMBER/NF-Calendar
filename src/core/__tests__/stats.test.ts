import { countTasks, countTasksFromListItems, getWordCount, summarizeMonth } from "../stats";

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
    expect(countTasksFromListItems([{ task: "x" }, { task: " " }, {}, { task: "X" }])).toEqual({ done: 2, open: 1 });
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
    expect(summarizeMonth([])).toMatchObject({ totalWords: 0, avgWordsPerDay: 0, avgWordsPerNote: 0 });
  });
});
