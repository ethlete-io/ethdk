import { css, html } from '@design-explore';

/** Three series over four quarters; every frame draws all of them, then the same chart with 2025 filtered out. */
export const SERIES = ['2024', '2025', '2026'];
export const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];
export const VALUES = [
  [42, 55, 61, 70],
  [48, 60, 58, 76],
  [53, 66, 72, 84],
];
export const FILTERED = [0, 2];
export const TICKS = [0, 20, 40, 60, 80, 100];
const DOMAIN_MAX = 100;

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';

export const BLUE = '#2f6fdf';
export const TEAL = '#14948a';
export const PURPLE = '#8a4fd8';
export const PALETTE = [BLUE, TEAL, PURPLE];

export const FRAME_WIDTH = 900;
const FRAME_PADDING = 16;
const PANEL_GAP = 32;
const AXIS_WIDTH = 28;
const AXIS_GAP = 8;
const PANEL_WIDTH = (FRAME_WIDTH - FRAME_PADDING * 2 - PANEL_GAP) / 2;
const PLOT_WIDTH = PANEL_WIDTH - AXIS_WIDTH - AXIS_GAP;
const PLOT_HEIGHT = 200;

const BAR_GAP = 2;
const BAR_RADIUS = 4;
const MAX_BAR_WIDTH = 24;
const GROUP_PADDING = 0.2;

const step = PLOT_WIDTH / CATEGORIES.length;
const valueY = (value: number) => PLOT_HEIGHT - (value / DOMAIN_MAX) * PLOT_HEIGHT;

const barPath = (x: number, width: number, value: number) => {
  const y = valueY(value);
  const right = x + width;
  const r = BAR_RADIUS;

  return `M${x},${PLOT_HEIGHT}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${right - r}A${r},${r} 0 0 1 ${right},${y + r}V${PLOT_HEIGHT}Z`;
};

const bars = (members: number[], fills: string[]) => {
  const count = members.length;
  const bandWidth = Math.min(
    MAX_BAR_WIDTH,
    (step - Math.max(BAR_GAP, step * GROUP_PADDING) - (count - 1) * BAR_GAP) / count,
  );
  const groupWidth = bandWidth * count + (count - 1) * BAR_GAP;

  return CATEGORIES.map((_, index) =>
    members
      .map((member, slot) => {
        const x = index * step + (step - groupWidth) / 2 + slot * (bandWidth + BAR_GAP);
        return `<path d="${barPath(x, bandWidth, VALUES[member]?.[index] ?? 0)}" style="fill: ${fills[slot]}" />`;
      })
      .join(''),
  ).join('');
};

const gridLines = TICKS.map((tick) => {
  const y = valueY(tick) + 0.5;
  return `<line class="grid-line" x1="0" y1="${y}" x2="${PLOT_WIDTH}" y2="${y}" />`;
}).join('');

const legend = (members: number[], fills: string[]) => html`
  <ul class="legend">
    ${members.map(
      (member, slot) =>
        html`<li class="legend-item">
          <span class="legend-swatch" style="background: ${fills[slot]}"></span>
          <span>${SERIES[member]}</span>
        </li>`,
    )}
  </ul>
`;

/** One chart: the legend above, the plot with its axes. `fills` holds one paint per entry of `members`. */
const chart = (title: string, members: number[], fills: string[]) => html`
  <section class="panel">
    <h3 class="panel-title">${title}</h3>
    ${legend(members, fills)}
    <div class="figure">
      <div class="value-axis">
        ${TICKS.map((tick) => html`<span class="axis-label" style="top: ${valueY(tick)}px">${tick}</span>`)}
      </div>
      <div class="plot">
        <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
          <g>${gridLines}</g>
          <g>${bars(members, fills)}</g>
        </svg>
      </div>
      <div class="category-axis">
        ${CATEGORIES.map(
          (name, index) => html`<span class="axis-label" style="left: ${index * step + step / 2}px">${name}</span>`,
        )}
      </div>
    </div>
  </section>
`;

/**
 * The shared frame: "All series" left, "2025 filtered out" right, the app-side code below.
 * `allFills` has one paint per series; `filteredFills` one per entry of `FILTERED`.
 */
export const states = (allFills: string[], filteredFills: string[], code: string) => html`
  <div class="states">
    ${chart('All series', [0, 1, 2], allFills)} ${chart('2025 filtered out', FILTERED, filteredFills)}
  </div>
  <pre class="code">${code}</pre>
`;

export const frameStyles = css`
  html {
    background: ${SURFACE};
  }

  #root {
    display: block;
    padding: ${FRAME_PADDING}px;
    background: ${SURFACE};
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: ${MUTED};
  }

  .states {
    display: grid;
    grid-template-columns: ${PANEL_WIDTH}px ${PANEL_WIDTH}px;
    gap: ${PANEL_GAP}px;
  }

  .panel-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: ${INK};
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
    stroke: ${BORDER};
    stroke-width: 1px;
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
    margin: 20px 0 0;
    padding: 10px 12px;
    border: 1px solid ${BORDER};
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: ${INK};
    white-space: pre;
  }
`;
