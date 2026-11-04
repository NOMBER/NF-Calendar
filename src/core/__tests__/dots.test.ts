import { dotsFor, sanitizeDotsMode, taskDots, wordDots } from "../dots";

const facts = (
  o: Partial<{ exists: boolean; words: number; tasksDone: number; tasksOpen: number }>,
) => ({
  exists: true,
  words: 0,
  tasksDone: 0,
  tasksOpen: 0,
  ...o,
});

describe("dots", () => {
  it("sanitizes mode with tasks as default", () => {
    expect(sanitizeDotsMode("words")).toBe("words");
    expect(sanitizeDotsMode("x")).toBe("tasks");
    expect(sanitizeDotsMode(undefined)).toBe("tasks");
  });

  it("tasks: filled share of done, max 5, never all filled unless all done", () => {
    expect(taskDots(0, 0)).toEqual([]);
    expect(taskDots(2, 1).map((d) => d.isFilled)).toEqual([true, true, false]);
    expect(taskDots(3, 0).every((d) => d.isFilled)).toBe(true);
    expect(taskDots(9, 1)).toHaveLength(5);
    expect(taskDots(9, 1).filter((d) => d.isFilled)).toHaveLength(4);
    expect(taskDots(0, 4).every((d) => !d.isFilled && d.className === "task")).toBe(true);
  });

  it("words: fixed thresholds", () => {
    expect(wordDots(0)).toBe(0);
    expect(wordDots(1)).toBe(1);
    expect(wordDots(250)).toBe(2);
    expect(wordDots(999)).toBe(3);
    expect(wordDots(50000)).toBe(5);
    expect(wordDots(NaN)).toBe(0);
  });

  it("dotsFor per mode", () => {
    expect(dotsFor("none", facts({ words: 900, tasksDone: 1 }))).toEqual([]);
    expect(dotsFor("exists", facts({}))).toEqual([{ isFilled: true }]);
    expect(dotsFor("exists", facts({ exists: false }))).toEqual([]);
    expect(dotsFor("words", facts({ words: 600 }))).toHaveLength(3);
    expect(dotsFor("tasks", facts({ tasksDone: 1, tasksOpen: 1 }))).toHaveLength(2);
  });
});
