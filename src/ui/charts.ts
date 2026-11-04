/**
 * Small SVG charts for the statistics modal. Pure DOM (createElementNS),
 * no libraries, no innerHTML; colours come from theme CSS variables
 * (see .cwt-chart-* in styles.css). Data comes from src/core/charts.ts.
 */
import { donutArcs, linePoints } from "src/core/charts";
import type { ChartKind, ICompletion, ISeriesChart } from "src/core/charts";

const NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  parent?.appendChild(el);
  return el;
}

/** Floating tooltip inside the chart wrapper. */
function tooltip(wrapper: HTMLElement) {
  const tip = wrapper.createDiv("cwt-chart-tip");
  tip.hide();
  return {
    show: (e: MouseEvent, text: string) => {
      tip.setText(text);
      tip.show();
      const r = wrapper.getBoundingClientRect();
      tip.style.left = `${Math.min(e.clientX - r.left + 8, r.width - tip.offsetWidth - 4)}px`;
      tip.style.top = `${e.clientY - r.top - 28}px`;
    },
    hide: () => tip.hide(),
  };
}

const W = 320;
const H = 160;
const PAD = { left: 30, right: 6, top: 8, bottom: 18 };

/**
 * Bar or line chart. `labelOf(seriesKey)` names a series in the tooltip;
 * `dayTitle(i)` names the x position (e.g. "Mon 3").
 */
export function renderSeriesChart(
  parent: HTMLElement,
  data: ISeriesChart,
  kind: ChartKind,
  labelOf: (key: string) => string,
  dayTitle: (i: number) => string,
): void {
  const wrapper = parent.createDiv("cwt-chart");
  const tip = tooltip(wrapper);
  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "cwt-chart-svg",
    role: "img",
  });
  wrapper.prepend(svg);
  const w = W - PAD.left - PAD.right;
  const h = H - PAD.top - PAD.bottom;
  const plot = svgEl("g", { transform: `translate(${PAD.left},${PAD.top})` }, svg);

  for (const tick of data.ticks) {
    const y = h - (tick / data.max) * h;
    svgEl("line", { x1: 0, x2: w, y1: y, y2: y, class: "cwt-chart-grid" }, plot);
    svgEl(
      "text",
      { x: -4, y: y + 3, class: "cwt-chart-axis", "text-anchor": "end" },
      plot,
    ).textContent = String(tick);
  }
  const n = data.labels.length;
  const slot = n ? w / n : w;
  data.labels.forEach((label, i) => {
    if (n <= 10 || i % 5 === 0 || i === n - 1) {
      svgEl(
        "text",
        { x: slot * i + slot / 2, y: h + 13, class: "cwt-chart-axis", "text-anchor": "middle" },
        plot,
      ).textContent = label;
    }
  });

  const describe = (i: number) =>
    `${dayTitle(i)}: ${data.series.map((s) => `${labelOf(s.key)} ${s.values[i]}`).join(", ")}`;

  if (kind === "bar") {
    const groups = data.series.length;
    const barW = Math.max(1, (slot * 0.8) / groups);
    data.series.forEach((s, si) => {
      s.values.forEach((v, i) => {
        const bh = (Math.max(0, v) / data.max) * h;
        svgEl(
          "rect",
          {
            x: slot * i + slot * 0.1 + barW * si,
            y: h - bh,
            width: barW,
            height: Math.max(0, bh),
            class: `cwt-chart-bar cwt-series-${s.key}`,
          },
          plot,
        );
      });
    });
  } else {
    data.series.forEach((s) => {
      const pts = linePoints(s.values, data.max, w - slot, h).map(([x, y]) => [x + slot / 2, y]);
      svgEl(
        "polyline",
        {
          points: pts.map((p) => p.join(",")).join(" "),
          class: `cwt-chart-line cwt-series-${s.key}`,
        },
        plot,
      );
      pts.forEach(([x, y]) =>
        svgEl(
          "circle",
          { cx: x, cy: y, r: 1.8, class: `cwt-chart-point cwt-series-${s.key}` },
          plot,
        ),
      );
    });
  }

  // Invisible hover columns: one per day, shows the tooltip.
  data.labels.forEach((_, i) => {
    const hit = svgEl(
      "rect",
      { x: slot * i, y: 0, width: slot, height: h, class: "cwt-chart-hit" },
      plot,
    );
    hit.addEventListener("pointermove", (e) => tip.show(e, describe(i)));
    hit.addEventListener("pointerleave", () => tip.hide());
  });

  if (data.series.length > 1) {
    const legend = wrapper.createDiv("cwt-chart-legend");
    data.series.forEach((s) => {
      const item = legend.createSpan("cwt-chart-legend-item");
      item.createSpan({ cls: `cwt-chart-swatch cwt-series-${s.key}` });
      item.appendText(labelOf(s.key));
    });
  }
}

/** Donut: days with ✓ / with a note without ✓ / without a note. */
export function renderDonut(
  parent: HTMLElement,
  data: ICompletion,
  labelOf: (key: string) => string,
): void {
  const wrapper = parent.createDiv("cwt-chart cwt-chart-donut");
  const tip = tooltip(wrapper);
  const size = 160;
  const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "cwt-chart-svg", role: "img" });
  wrapper.prepend(svg);
  const parts = [
    { key: "allDone", value: data.allDone },
    { key: "notDone", value: data.notDone },
    { key: "noNote", value: data.noNote },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  for (const arc of donutArcs(parts, size / 2, size / 2, 70, 44)) {
    const path = svgEl("path", { d: arc.path, class: `cwt-chart-arc cwt-series-${arc.key}` }, svg);
    const pct = total ? Math.round((arc.value / total) * 100) : 0;
    path.addEventListener("pointermove", (e) =>
      tip.show(e, `${labelOf(arc.key)}: ${arc.value} (${pct}%)`),
    );
    path.addEventListener("pointerleave", () => tip.hide());
  }
  svgEl(
    "text",
    { x: size / 2, y: size / 2 + 5, class: "cwt-chart-center", "text-anchor": "middle" },
    svg,
  ).textContent = `${data.allDone} ✓`;
  const legend = wrapper.createDiv("cwt-chart-legend");
  parts.forEach((p) => {
    const item = legend.createSpan("cwt-chart-legend-item");
    item.createSpan({ cls: `cwt-chart-swatch cwt-series-${p.key}` });
    item.appendText(`${labelOf(p.key)}: ${p.value}`);
  });
}
