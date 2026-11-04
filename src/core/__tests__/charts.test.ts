import {
  completionBreakdown,
  cumulative,
  donutArcs,
  linePoints,
  niceScale,
  seriesFor,
} from "../charts";
import type { IDayStats } from "../stats";

const day = (n: number, words: number, done = 0, open = 0, hasNote = true): IDayStats => ({
  date: `2026-11-${String(n).padStart(2, "0")}`,
  hasNote,
  words,
  tasksDone: done,
  tasksOpen: open,
});

const days = [day(1, 100, 2, 0), day(2, 0, 0, 0, false), day(3, 250, 1, 3), day(4, 50, 0, 0)];

describe("charts data", () => {
  test("niceScale", () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(250)).toEqual({ max: 300, ticks: [0, 100, 200, 300] });
    expect(niceScale(7).max).toBe(8);
    expect(niceScale(1234).ticks[niceScale(1234).ticks.length - 1]).toBe(niceScale(1234).max);
  });

  test("cumulative", () => {
    expect(cumulative([1, 2, 0, 3])).toEqual([1, 3, 3, 6]);
  });

  test("series per metric", () => {
    const w = seriesFor(days, "words");
    expect(w.labels).toEqual(["1", "2", "3", "4"]);
    expect(w.series[0].values).toEqual([100, 0, 250, 50]);
    expect(w.max).toBeGreaterThanOrEqual(250);
    expect(seriesFor(days, "cumulative").series[0].values).toEqual([100, 100, 350, 400]);
    const t = seriesFor(days, "tasks");
    expect(t.series.map((s) => s.key)).toEqual(["done", "open"]);
    expect(t.series[1].values).toEqual([0, 0, 3, 0]);
  });

  test("completion breakdown", () => {
    expect(completionBreakdown(days)).toEqual({ allDone: 1, notDone: 2, noNote: 1 });
  });

  test("donut arcs skip zero parts and handle a full circle", () => {
    const arcs = donutArcs(
      [
        { key: "a", value: 1 },
        { key: "b", value: 0 },
        { key: "c", value: 3 },
      ],
      50,
      50,
      40,
      25,
    );
    expect(arcs.map((a) => a.key)).toEqual(["a", "c"]);
    expect(arcs[0].path.startsWith("M 50.000 10.000")).toBe(true);
    expect(arcs[1].path).toContain(" 1 1 "); // > half: large arc flag
    const full = donutArcs([{ key: "x", value: 5 }], 50, 50, 40, 25);
    expect(full[0].path.match(/M /g)?.length).toBe(2);
    expect(donutArcs([{ key: "x", value: 0 }], 50, 50, 40, 25)).toEqual([]);
  });

  test("line points", () => {
    expect(linePoints([0, 5, 10], 10, 100, 50)).toEqual([
      [0, 50],
      [50, 25],
      [100, 0],
    ]);
    expect(linePoints([3], 10, 100, 50)[0][0]).toBe(50);
  });
});
