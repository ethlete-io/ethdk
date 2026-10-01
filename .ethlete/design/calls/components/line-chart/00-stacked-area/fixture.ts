import { css, html } from '@design-explore';

/** Active subscriptions per plan, in thousands, stacked over twelve months. Drawn on a light and a dark card. */
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type SeriesInput = { label: string; colorTheme: string; values: number[] };

const SERIES: SeriesInput[] = [
  { label: 'Free', colorTheme: 'chart-blue', values: [22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 38, 40] },
  { label: 'Starter', colorTheme: 'chart-orange', values: [14, 15, 15, 16, 18, 19, 19, 21, 22, 22, 24, 25] },
  { label: 'Team', colorTheme: 'chart-aqua', values: [9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 16, 17] },
  { label: 'Enterprise', colorTheme: 'chart-yellow', values: [4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 9] },
];

export const TICKS = [0, 25, 50, 75, 100];
const DOMAIN_MAX = 100;

export const FRAME_WIDTH = 900;
export const FRAME_PADDING = 16;
const PANEL_GAP = 16;
const PANEL_PADDING = 16;
const PANEL_WIDTH = (FRAME_WIDTH - FRAME_PADDING * 2 - PANEL_GAP) / 2;
const AXIS_WIDTH = 24;
const AXIS_GAP = 8;
export const PLOT_WIDTH = PANEL_WIDTH - PANEL_PADDING * 2 - AXIS_WIDTH - AXIS_GAP;
export const PLOT_HEIGHT = 200;

const x = (index: number) => (index / (MONTHS.length - 1)) * PLOT_WIDTH;
const y = (value: number) => PLOT_HEIGHT - (value / DOMAIN_MAX) * PLOT_HEIGHT;
const round = (value: number) => Math.round(value * 100) / 100;

export type Band = {
  key: string;
  label: string;
  colorTheme: string;
  linePath: string;
  areaPath: string;
  /** The highest point of the band's top edge, in plot pixels, for gradients that start at the band. */
  top: number;
};

let below = MONTHS.map(() => 0);

export const BANDS: Band[] = SERIES.map((series, index) => {
  const lower = below;
  const upper = lower.map((sum, month) => sum + (series.values[month] ?? 0));
  below = upper;

  const top = upper.map((value, month) => `${month ? 'L' : 'M'}${round(x(month))},${round(y(value))}`).join('');
  const bottom = [...lower]
    .map((value, month) => ({ value, month }))
    .reverse()
    .map(({ value, month }) => `L${round(x(month))},${round(y(value))}`)
    .join('');

  return {
    key: `s${index}`,
    label: series.label,
    colorTheme: series.colorTheme,
    linePath: top,
    areaPath: `${top}${bottom}Z`,
    top: Math.min(...upper.map(y)),
  };
});

export type Surface = 'light' | 'dark';

/** Draws the series layer of one panel; `surface` keeps SVG ids unique per panel. */
export type SeriesLayer = (surface: Surface) => string;

/** The shipped order: per series, its area, then its line. */
export const shippedLayer: SeriesLayer = () =>
  BANDS.map(
    (band) =>
      html`<g class="series et-color--${band.colorTheme}">
        <path class="area" d="${band.areaPath}" />
        <path class="line" d="${band.linePath}" />
      </g>`,
  ).join('');

const gridLines = TICKS.map((tick) => {
  const lineY = y(tick) + 0.5;
  return `<line class="grid-line" x1="0" y1="${lineY}" x2="${PLOT_WIDTH}" y2="${lineY}" />`;
}).join('');

const figure = (surface: Surface, layer: SeriesLayer) => html`
  <ul class="legend">
    ${BANDS.map(
      (band) =>
        html`<li class="legend-item et-color--${band.colorTheme}">
          <span class="legend-swatch"></span>
          <span>${band.label}</span>
        </li>`,
    )}
  </ul>
  <div class="figure">
    <div class="value-axis">
      ${TICKS.map((tick) => html`<span class="axis-label" style="top: ${y(tick)}px">${tick}k</span>`)}
    </div>
    <svg class="plot-svg" width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
      <g>${gridLines}</g>
      ${layer(surface)}
    </svg>
    <div class="category-axis">
      ${MONTHS.map((name, index) => html`<span class="axis-label" style="left: ${x(index)}px">${name}</span>`)}
    </div>
  </div>
`;

const panel = (surface: Surface, layer: SeriesLayer) => html`
  <section class="panel et-surface--${surface}">
    <p class="panel-label">${surface === 'light' ? 'Light surface' : 'Dark surface'}</p>
    ${figure(surface, layer)}
  </section>
`;

/** The same stacked chart on a light card and on a dark card. */
export const chartPair = (layer: SeriesLayer) => html`
  <div class="pair">${panel('light', layer)} ${panel('dark', layer)}</div>
`;

/**
 * Stand-ins for what the app registers: the storybook light and dark surface themes and the
 * four chart colour themes, as the derived tokens the generated CSS puts on each scope class.
 * Variants consume only the tokens.
 */
const appThemes = css`
  .et-surface--light {
    --et-surface-background-solid: rgb(255 255 255);
    --et-surface-color-solid: rgb(23 23 23);
    --et-surface-color-muted-solid: rgb(115 115 115);
    --et-surface-border-solid: rgb(229 229 229);
  }

  .et-surface--dark {
    --et-surface-background-solid: rgb(23 23 23);
    --et-surface-color-solid: rgb(250 250 250);
    --et-surface-color-muted-solid: rgb(161 161 161);
    --et-surface-border-solid: rgb(64 64 64);
  }

  .et-color--chart-blue {
    --et-theme-color-primary-solid: rgb(42 120 214);
  }

  .et-color--chart-orange {
    --et-theme-color-primary-solid: rgb(235 104 52);
  }

  .et-color--chart-aqua {
    --et-theme-color-primary-solid: rgb(27 175 122);
  }

  .et-color--chart-yellow {
    --et-theme-color-primary-solid: rgb(237 161 0);
  }
`;

export const frameStyles = css`
  ${appThemes}

  html {
    background: rgb(243 244 246);
  }

  #root {
    display: block;
    padding: ${FRAME_PADDING}px;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.4;
  }

  .pair {
    display: grid;
    grid-template-columns: ${PANEL_WIDTH}px ${PANEL_WIDTH}px;
    gap: ${PANEL_GAP}px;
  }

  .panel {
    box-sizing: border-box;
    padding: ${PANEL_PADDING}px;
    border: 1px solid var(--et-surface-border-solid);
    border-radius: 8px;
    background: var(--et-surface-background-solid);
    color: var(--et-surface-color-muted-solid);
  }

  .panel-label {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--et-surface-color-solid);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    column-gap: 16px;
    row-gap: 4px;
    margin: 0 0 18px;
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
    background: var(--et-theme-color-primary-solid);
  }

  .figure {
    display: grid;
    grid-template-columns: ${AXIS_WIDTH}px ${PLOT_WIDTH}px;
    grid-template-areas:
      'value-axis plot'
      '. category-axis';
    gap: ${AXIS_GAP}px;
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

  .plot-svg {
    grid-area: plot;
    display: block;
    overflow: visible;
  }

  .category-axis {
    grid-area: category-axis;
    position: relative;
    block-size: 16px;
  }

  .category-axis .axis-label {
    position: absolute;
    top: 0;
    translate: -50% 0;
  }

  .axis-label {
    font-size: 11px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .grid-line {
    stroke: var(--et-surface-border-solid);
    stroke-width: 1px;
    shape-rendering: crispEdges;
  }

  .series {
    --_color: var(--et-theme-color-primary-solid);
  }

  .line {
    fill: none;
    stroke: var(--_color);
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .area {
    fill: var(--_color);
  }
`;
