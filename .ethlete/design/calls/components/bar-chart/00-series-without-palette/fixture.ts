import { css, html } from '@design-explore';

/** Three series over four quarters, drawn as a grouped vertical bar chart in every frame. */
export const SERIES = ['2024', '2025', '2026'];
export const CATEGORIES = ['Q1', 'Q2', 'Q3', 'Q4'];
export const VALUES = [
  [42, 55, 61, 70],
  [48, 60, 58, 76],
  [53, 66, 72, 84],
];
export const TICKS = [0, 20, 40, 60, 80, 100];
const DOMAIN_MAX = 100;

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';
export const ACCENT = '#2f6fdf';

export const FRAME_PADDING = 16;
export const AXIS_WIDTH = 28;
export const AXIS_GAP = 8;
export const PLOT_WIDTH = 520 - FRAME_PADDING * 2 - AXIS_WIDTH - AXIS_GAP;
export const PLOT_HEIGHT = 240;

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

/** The bars, one fill per series: any CSS paint, so `url(#id)` draws a pattern and `color-mix()` a step. */
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

/** The plot SVG: gridlines and bars. `defs` holds any pattern a fill names. */
export const plot = (fills: string[], defs = '') => html`
  <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
    <defs>${defs}</defs>
    <g>${gridLines}</g>
    <g>${bars(fills)}</g>
  </svg>
`;

/** The shipped legend: left-aligned above the plot, one 10px rounded square per series. */
export const legend = (swatches: string[]) => html`
  <ul class="legend">
    ${SERIES.map(
      (name, index) =>
        html`<li class="legend-item">
          <span class="legend-swatch" style="background: ${swatches[index]}"></span>
          <span>${name}</span>
        </li>`,
    )}
  </ul>
`;

/** The axes around whatever fills the plot area. */
export const figure = (plotArea: string, withAxes = true) => html`
  <div class="figure">
    <div class="value-axis">
      ${withAxes && TICKS.map((tick) => html`<span class="axis-label" style="top: ${valueY(tick)}px">${tick}</span>`)}
    </div>
    <div class="plot">${plotArea}</div>
    <div class="category-axis">
      ${
        withAxes &&
        CATEGORIES.map(
          (name, index) => html`<span class="axis-label" style="left: ${index * step + step / 2}px">${name}</span>`,
        )
      }
    </div>
  </div>
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
`;
