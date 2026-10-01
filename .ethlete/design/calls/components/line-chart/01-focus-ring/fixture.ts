import { css, html } from '@design-explore';

/**
 * Two series drawn twice per frame: 90 daily values (Jul 1 - Sep 28), then 12 monthly values.
 * One x is keyboard-focused in each chart. The token values on #root stand in for an app's light theme.
 */
type Series = { name: string; values: number[] };
type Dataset = { caption: string; labels: string[]; tickEvery: number; series: Series[]; focus: number };

const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const daily = (base: number, trend: number, weekend: number, seed: number) => {
  const random = seeded(seed);
  return Array.from({ length: 90 }, (_, day) => {
    const weekday = (day + 2) % 7;
    const dip = weekday >= 5 ? weekend : 1;
    return Math.round((base + trend * day) * dip * (0.88 + random() * 0.24));
  });
};

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const DAY_LABELS = Array.from({ length: 90 }, (_, day) => dayFormat.format(Date.UTC(2026, 6, 1 + day)));
const MONTH_LABELS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

export const DENSE: Dataset = {
  caption: 'Dense · 90 daily values · Aug 23 focused',
  labels: DAY_LABELS,
  tickEvery: 14,
  series: [
    { name: 'Web sessions', values: daily(3200, 14, 0.7, 7) },
    { name: 'App sessions', values: daily(2100, 9, 1.25, 19) },
  ],
  focus: 53,
};

export const SPARSE: Dataset = {
  caption: 'Sparse · 12 monthly values · May focused',
  labels: MONTH_LABELS,
  tickEvery: 1,
  series: [
    { name: 'Web sessions', values: [81, 86, 92, 79, 84, 95, 101, 108, 104, 112, 118, 124].map((v) => v * 1000) },
    { name: 'App sessions', values: [52, 55, 63, 60, 66, 71, 74, 83, 88, 85, 93, 99].map((v) => v * 1000) },
  ],
  focus: 7,
};

export const FRAME_WIDTH = 720;
export const FRAME_PADDING = 16;
const AXIS_WIDTH = 36;
const AXIS_GAP = 8;
export const PLOT_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2 - AXIS_WIDTH - AXIS_GAP;
export const PLOT_HEIGHT = 160;
export const POINT_RADIUS = 5;
const TICK_COUNT = 4;

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const niceMax = (max: number) => {
  const rough = max / TICK_COUNT;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  return { max: step * TICK_COUNT, step };
};

/** One focused x: its position, its slice target (the stretch closer to it than to a neighbour), and each series' point. */
export type FocusContext = {
  x: number;
  start: number;
  width: number;
  height: number;
  plotWidth: number;
  points: { series: number; y: number }[];
  tickLabel: string;
};

const geometry = (data: Dataset) => {
  const count = data.labels.length;
  const all = data.series.flatMap((s) => s.values);
  const { max, step } = niceMax(Math.max(...all));
  const xAt = (index: number) => (index / (count - 1)) * PLOT_WIDTH;
  const yAt = (value: number) => PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i * step);
  return { count, xAt, yAt, ticks };
};

const focusContext = (data: Dataset): FocusContext => {
  const { count, xAt, yAt } = geometry(data);
  const index = data.focus;
  const x = xAt(index);
  const start = index === 0 ? 0 : (xAt(index - 1) + x) / 2;
  const end = index === count - 1 ? PLOT_WIDTH : (x + xAt(index + 1)) / 2;
  return {
    x,
    start,
    width: end - start,
    height: PLOT_HEIGHT,
    plotWidth: PLOT_WIDTH,
    points: data.series.map((s, series) => ({ series, y: yAt(s.values[index] ?? 0) })),
    tickLabel: data.labels[index] ?? '',
  };
};

/** The shipped crosshair: a 1px subtle line through the focused x. */
export const crosshair = (ctx: FocusContext) =>
  `<line class="crosshair" x1="${ctx.x}" x2="${ctx.x}" y1="0" y2="${ctx.height}" shape-rendering="crispEdges" />`;

/** The shipped slice points: one 5px dot per series at the focused x, ringed in the surface colour. */
export const slicePoints = (ctx: FocusContext) =>
  ctx.points
    .map(
      (p) => `<circle class="slice-point" data-series="${p.series}" cx="${ctx.x}" cy="${p.y}" r="${POINT_RADIUS}" />`,
    )
    .join('');

/** A focus layer draws on top of the plot, in plot coordinates, and may reach outside it. */
export type FocusLayer = (ctx: FocusContext) => { svg: string; xAxis?: string };

const chart = (data: Dataset, focus: FocusLayer) => {
  const { count, xAt, yAt, ticks } = geometry(data);
  const ctx = focusContext(data);
  const layer = focus(ctx);
  const grid = ticks
    .map((tick) => {
      const y = Math.round(yAt(tick)) + 0.5;
      return `<line class="grid-line" x1="0" x2="${PLOT_WIDTH}" y1="${y}" y2="${y}" />`;
    })
    .join('');
  const lines = data.series
    .map((s, series) => {
      const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`).join('');
      return `<path class="line" data-series="${series}" d="${d}" />`;
    })
    .join('');
  const xLabels = Array.from({ length: count }, (_, i) => i)
    .filter((i) => i % data.tickEvery === 0)
    .map((i) => html`<span class="axis-label" style="left: ${xAt(i)}px">${data.labels[i]}</span>`);

  return html`
    <p class="caption">${data.caption}</p>
    <ul class="legend">
      ${data.series.map(
        (s, series) => html`<li class="legend-item"><span class="swatch" data-series="${series}"></span>${s.name}</li>`,
      )}
    </ul>
    <div class="figure">
      <div class="value-axis">
        ${ticks.map((tick) => html`<span class="axis-label" style="top: ${yAt(tick)}px">${compact.format(tick)}</span>`)}
      </div>
      <div class="plot">
        <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
          <g>${grid}</g>
          <g>${lines}</g>
          <g class="focus">${layer.svg}</g>
        </svg>
      </div>
      <div class="x-axis">${xLabels}${layer.xAxis ?? ''}</div>
    </div>
  `;
};

/** Every frame: the dense chart, then the sparse one, each with one x focused by the variant's layer. */
export const charts = (focus: FocusLayer) => html`
  <div class="block">${chart(DENSE, focus)}</div>
  <div class="block">${chart(SPARSE, focus)}</div>
`;

export const frameStyles = css`
  html {
    background: #ffffff;
  }

  #root {
    --et-surface-background-solid: #ffffff;
    --et-surface-color-solid: #1c1f24;
    --et-surface-color-muted-solid: #5f6670;
    --et-surface-color-subtle-solid: #8a9099;
    --et-surface-border-solid: #e3e5e8;
    --et-surface-interaction-solid: #1c1f24;
    --et-theme-color-primary-solid: #2f6fdf;

    display: block;
    padding: ${FRAME_PADDING}px;
    background: var(--et-surface-background-solid);
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: var(--et-surface-color-muted-solid);
  }

  [data-series='0'] {
    --_series: var(--et-theme-color-primary-solid);
  }

  [data-series='1'] {
    --et-theme-color-primary-solid: #d9682a;
    --_series: var(--et-theme-color-primary-solid);
  }

  .block {
    margin-block-end: 28px;
  }

  .caption {
    margin: 0 0 8px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
  }

  .legend {
    display: flex;
    gap: 16px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 2px;
    background: var(--_series);
  }

  .figure {
    display: grid;
    grid-template-columns: ${AXIS_WIDTH}px ${PLOT_WIDTH}px;
    grid-template-areas:
      'value-axis plot'
      '. x-axis';
    gap: ${AXIS_GAP}px;
    padding-block-start: 0.7em;
  }

  .value-axis {
    grid-area: value-axis;
    position: relative;
    block-size: ${PLOT_HEIGHT}px;
  }

  .value-axis .axis-label {
    position: absolute;
    right: 0;
    translate: 0 -50%;
  }

  .plot {
    grid-area: plot;
    position: relative;
    block-size: ${PLOT_HEIGHT}px;
  }

  .plot-svg {
    display: block;
    overflow: visible;
  }

  .grid-line {
    stroke: var(--et-surface-border-solid);
    stroke-width: 1px;
  }

  .line {
    fill: none;
    stroke: var(--_series);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .crosshair {
    stroke: var(--et-surface-color-subtle-solid);
    stroke-width: 1px;
  }

  .slice-point {
    fill: var(--_series);
    stroke: var(--et-surface-background-solid);
    stroke-width: 2px;
  }

  .x-axis {
    grid-area: x-axis;
    position: relative;
    block-size: 1.4em;
  }

  .x-axis .axis-label {
    position: absolute;
    top: 0;
    translate: -50% 0;
  }

  .axis-label {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`;
