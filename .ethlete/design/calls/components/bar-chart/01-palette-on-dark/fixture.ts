import { css, html } from '@design-explore';

/** Three series over four quarters, drawn twice in every frame: on a light card and on a dark card. */
export const SERIES = ['2024', '2025', '2026'];
export const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];
export const VALUES = [
  [42, 55, 61, 70],
  [48, 60, 58, 76],
  [53, 66, 72, 84],
];
export const TICKS = [0, 20, 40, 60, 80, 100];
const DOMAIN_MAX = 100;

export const PAGE = '#f3f4f6';
export const LIGHT = { surface: '#ffffff', ink: '#1c1f24', muted: '#5f6670', border: '#e3e5e8' };
export const DARK = { surface: '#1a1e27', ink: '#eef0f4', muted: '#9aa1ad', border: '#2c323d' };

/** The app palette, tuned for a light surface: a deep blue, a deep teal, a deep purple. */
export const PALETTE = ['#1e3a8a', '#0f6b66', '#5b2a86'];

export const FRAME_WIDTH = 900;
export const FRAME_PADDING = 16;
const PANEL_GAP = 16;
const PANEL_PADDING = 16;
const PANEL_WIDTH = (FRAME_WIDTH - FRAME_PADDING * 2 - PANEL_GAP) / 2;
export const AXIS_WIDTH = 28;
export const AXIS_GAP = 8;
export const PLOT_WIDTH = PANEL_WIDTH - PANEL_PADDING * 2 - AXIS_WIDTH - AXIS_GAP;
export const PLOT_HEIGHT = 220;

const BAR_GAP = 2;
const BAR_RADIUS = 4;
const MAX_BAR_WIDTH = 24;
const GROUP_PADDING = 0.2;

const step = PLOT_WIDTH / CATEGORIES.length;
const bandWidth = Math.min(
  MAX_BAR_WIDTH,
  (step - Math.max(BAR_GAP, step * GROUP_PADDING) - (SERIES.length - 1) * BAR_GAP) / SERIES.length,
);
const groupWidth = bandWidth * SERIES.length + (SERIES.length - 1) * BAR_GAP;
const valueY = (value: number) => PLOT_HEIGHT - (value / DOMAIN_MAX) * PLOT_HEIGHT;

const barPath = (x: number, value: number) => {
  const y = valueY(value);
  const right = x + bandWidth;
  const r = BAR_RADIUS;

  return `M${x},${PLOT_HEIGHT}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${right - r}A${r},${r} 0 0 1 ${right},${y + r}V${PLOT_HEIGHT}Z`;
};

const bars = (fills: string[]) =>
  CATEGORIES.map((_, index) =>
    SERIES.map((_, member) => {
      const x = index * step + (step - groupWidth) / 2 + member * (bandWidth + BAR_GAP);
      return `<path d="${barPath(x, VALUES[member]?.[index] ?? 0)}" style="fill: ${fills[member]}" />`;
    }).join(''),
  ).join('');

const gridLines = TICKS.map((tick) => {
  const y = valueY(tick) + 0.5;
  return `<line class="grid-line" x1="0" y1="${y}" x2="${PLOT_WIDTH}" y2="${y}" />`;
}).join('');

const plot = (fills: string[]) => html`
  <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
    <g>${gridLines}</g>
    <g>${bars(fills)}</g>
  </svg>
`;

const legend = (fills: string[]) => html`
  <ul class="legend">
    ${SERIES.map(
      (name, index) =>
        html`<li class="legend-item">
          <span class="legend-swatch" style="background: ${fills[index]}"></span>
          <span>${name}</span>
        </li>`,
    )}
  </ul>
`;

const figure = (fills: string[]) => html`
  <div class="figure">
    <div class="value-axis">
      ${TICKS.map((tick) => html`<span class="axis-label" style="top: ${valueY(tick)}px">${tick}</span>`)}
    </div>
    <div class="plot">${plot(fills)}</div>
    <div class="category-axis">
      ${CATEGORIES.map(
        (name, index) => html`<span class="axis-label" style="left: ${index * step + step / 2}px">${name}</span>`,
      )}
    </div>
  </div>
`;

const panel = (kind: 'light' | 'dark', fills: string[]) => html`
  <section class="panel panel--${kind}">
    <p class="panel-label">${kind === 'light' ? 'Light surface' : 'Dark card'}</p>
    ${legend(fills)} ${figure(fills)}
  </section>
`;

/** The same chart on a light card and on a dark card. Each fill is any CSS paint. */
export const chartPair = (lightFills: string[], darkFills: string[]) => html`
  <div class="pair">${panel('light', lightFills)} ${panel('dark', darkFills)}</div>
`;

/** The app-side code that produces the frame, plus an optional one-line note under it. */
export const codeBlock = (code: string, note = '') => html`
  <pre class="code">${code}</pre>
  ${note && html`<p class="note">${note}</p>`}
`;

export const frameStyles = css`
  html {
    background: ${PAGE};
  }

  #root {
    display: block;
    padding: ${FRAME_PADDING}px;
    background: ${PAGE};
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: ${LIGHT.muted};
  }

  .pair {
    display: grid;
    grid-template-columns: ${PANEL_WIDTH}px ${PANEL_WIDTH}px;
    gap: ${PANEL_GAP}px;
  }

  .panel {
    box-sizing: border-box;
    padding: ${PANEL_PADDING}px;
    border-radius: 8px;
  }

  .panel--light {
    background: ${LIGHT.surface};
    border: 1px solid ${LIGHT.border};
    color: ${LIGHT.muted};
  }

  .panel--dark {
    background: ${DARK.surface};
    border: 1px solid ${DARK.border};
    color: ${DARK.muted};
  }

  .panel-label {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .panel--light .panel-label {
    color: ${LIGHT.ink};
  }

  .panel--dark .panel-label {
    color: ${DARK.ink};
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
    row-gap: 4px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-swatch {
    flex: none;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 2px;
  }

  .figure {
    display: grid;
    grid-template-columns: ${AXIS_WIDTH}px ${PLOT_WIDTH}px;
    grid-template-areas:
      'value-axis plot'
      '. category-axis';
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
    block-size: ${PLOT_HEIGHT}px;
  }

  .plot-svg {
    display: block;
    overflow: visible;
  }

  .grid-line {
    stroke-width: 1px;
  }

  .panel--light .grid-line {
    stroke: ${LIGHT.border};
  }

  .panel--dark .grid-line {
    stroke: ${DARK.border};
  }

  .category-axis {
    grid-area: category-axis;
    position: relative;
    block-size: 1.4em;
  }

  .category-axis .axis-label {
    position: absolute;
    top: 0;
    translate: -50% 0;
  }

  .axis-label {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .code {
    margin: 16px 0 0;
    padding: 10px 12px;
    border: 1px solid ${LIGHT.border};
    border-radius: 6px;
    background: ${LIGHT.surface};
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: ${LIGHT.ink};
    white-space: pre;
  }

  .note {
    margin: 6px 0 0;
    font-size: 11px;
  }
`;
