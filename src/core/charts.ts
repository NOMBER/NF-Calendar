/**
 * Data preparation for the statistics charts (pure, no DOM).
 * The SVG drawing lives in src/ui/charts.ts.
 */
import { isAllTasksDone } from "./stats";
import type { IDayStats } from "./stats";

export type ChartMetric = "words" | "tasks" | "cumulative" | "completion";
export type ChartKind = "bar" | "line";

export const CHART_METRICS: ChartMetric[] = ["words", "tasks", "cumulative", "completion"];
export const CHART_KINDS: ChartKind[] = ["bar", "line"];

export interface ISeries {
  key: string;
  values: number[];
}

export interface ISeriesChart {
  /** Day of month labels ("1".."31"). */
  labels: string[];
  series: ISeries[];
  max: number;
  ticks: number[];
}

/** A round axis maximum (1, 2, 5 × 10^n) and ~4 evenly spaced ticks. */
export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) {
    return { max: 1, ticks: [0, 1] };
  }
  const rough = maxValue / tickCount;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return { max, ticks };
}

export function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

const dayLabel = (d: IDayStats) => String(Number(d.date.slice(8, 10)));

/** Series for bar / line charts of the chosen metric. */
export function seriesFor(
  days: IDayStats[],
  metric: Exclude<ChartMetric, "completion">,
): ISeriesChart {
  const labels = days.map(dayLabel);
  let series: ISeries[];
  switch (metric) {
    case "words":
      series = [{ key: "words", values: days.map((d) => d.words) }];
      break;
    case "cumulative":
      series = [{ key: "cumulative", values: cumulative(days.map((d) => d.words)) }];
      break;
    case "tasks":
      series = [
        { key: "done", values: days.map((d) => d.tasksDone) },
        { key: "open", values: days.map((d) => d.tasksOpen) },
      ];
      break;
  }
  const peak = Math.max(0, ...series.flatMap((s) => s.values));
  return { labels, series, ...niceScale(peak) };
}

export interface ICompletion {
  allDone: number;
  notDone: number;
  noNote: number;
}

/** Days with ✓ / with a note but without ✓ / without a note. */
export function completionBreakdown(days: IDayStats[]): ICompletion {
  const res = { allDone: 0, notDone: 0, noNote: 0 };
  for (const d of days) {
    if (!d.hasNote) {
      res.noNote++;
    } else if (isAllTasksDone(d)) {
      res.allDone++;
    } else {
      res.notDone++;
    }
  }
  return res;
}

export interface IArc {
  key: string;
  value: number;
  /** SVG path "d" for a donut segment. */
  path: string;
}

const point = (cx: number, cy: number, r: number, angle: number) =>
  `${(cx + r * Math.sin(angle)).toFixed(3)} ${(cy - r * Math.cos(angle)).toFixed(3)}`;

/**
 * Donut segments clockwise from 12 o'clock. Zero parts are skipped; a single
 * full part is drawn as two half arcs (one SVG arc cannot close a circle).
 */
export function donutArcs(
  parts: Array<{ key: string; value: number }>,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
): IArc[] {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) {
    return [];
  }
  const arcs: IArc[] = [];
  let angle = 0;
  for (const p of parts) {
    if (p.value <= 0) {
      continue;
    }
    const sweep = (p.value / total) * Math.PI * 2;
    const segment = (a0: number, a1: number) => {
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return (
        `M ${point(cx, cy, outer, a0)} A ${outer} ${outer} 0 ${large} 1 ${point(cx, cy, outer, a1)} ` +
        `L ${point(cx, cy, inner, a1)} A ${inner} ${inner} 0 ${large} 0 ${point(cx, cy, inner, a0)} Z`
      );
    };
    const path =
      sweep >= Math.PI * 2 - 1e-9
        ? `${segment(0, Math.PI)} ${segment(Math.PI, Math.PI * 2)}`
        : segment(angle, angle + sweep);
    arcs.push({ key: p.key, value: p.value, path });
    angle += sweep;
  }
  return arcs;
}

/** Polyline points for a line chart inside a w × h box (y grows down). */
export function linePoints(
  values: number[],
  max: number,
  w: number,
  h: number,
): Array<[number, number]> {
  const n = values.length;
  return values.map((v, i) => [
    n <= 1 ? w / 2 : (i / (n - 1)) * w,
    h - (max > 0 ? (Math.max(0, v) / max) * h : 0),
  ]);
}
