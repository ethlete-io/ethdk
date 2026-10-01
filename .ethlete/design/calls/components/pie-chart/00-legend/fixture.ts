import { css, html } from '@design-explore';

/** Seven traffic channels, one under 1% and one with a long name, drawn as the shipped 200px donut. */
type DatumInput = { label: string; value: number; color: string };

const DATA: DatumInput[] = [
  { label: 'Organic search', value: 4820, color: '#2f6fdf' },
  { label: 'Direct', value: 3140, color: '#e07b39' },
  { label: 'Paid social', value: 1960, color: '#2a9d8f' },
  { label: 'Email newsletter', value: 1210, color: '#c2477a' },
  { label: 'Referral from partner blogs and affiliate sites', value: 860, color: '#7a5cc7' },
  { label: 'Display ads', value: 430, color: '#b08d12' },
  { label: 'SMS', value: 38, color: '#6b8e23' },
];

export const SURFACE = '#ffffff';
export const INK = '#1c1f24';
export const MUTED = '#5f6670';
export const BORDER = '#e3e5e8';

export const FRAME_WIDTH = 720;
export const FRAME_PADDING = 16;
export const WIDE_WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;
export const NARROW_WIDTH = 300;
export const SIZE = 200;
export const LEGEND_GAP = 24;
const INNER_RADIUS = 0.6;
const SLICE_GAP = 2;

const TOTAL = DATA.reduce((sum, datum) => sum + datum.value, 0);
const numberFormat = new Intl.NumberFormat('en-US');

const wholePercentages = () => {
  const exact = DATA.map((datum) => (datum.value / TOTAL) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const entry of byRemainder) {
    if (remaining <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remaining--;
  }

  return floors;
};

export type PieEntry = DatumInput & {
  valueText: string;
  percentText: string;
  startAngle: number;
  endAngle: number;
};

const percents = wholePercentages();
let cursor = 0;

export const ENTRIES: PieEntry[] = DATA.map((datum, index) => {
  const percent = percents[index] ?? 0;
  const startAngle = cursor;
  cursor += (datum.value / TOTAL) * Math.PI * 2;

  return {
    ...datum,
    valueText: numberFormat.format(datum.value),
    percentText: percent === 0 ? '<1%' : `${percent}%`,
    startAngle,
    endAngle: cursor,
  };
});

export const TOTAL_TEXT = numberFormat.format(TOTAL);

const RADIUS = SIZE / 2;
const HOLE = RADIUS * INNER_RADIUS;

const point = (radius: number, angle: number) =>
  `${RADIUS + radius * Math.sin(angle)},${RADIUS - radius * Math.cos(angle)}`;

const arcPath = (entry: PieEntry) => {
  const outerPad = Math.min(SLICE_GAP / 2 / RADIUS, (entry.endAngle - entry.startAngle - 1 / RADIUS) / 2);
  const innerPad = Math.min(SLICE_GAP / 2 / HOLE, (entry.endAngle - entry.startAngle) / 2);
  const pad = Math.max(0, outerPad);
  const large = entry.endAngle - entry.startAngle - 2 * pad > Math.PI ? 1 : 0;

  return [
    `M${point(RADIUS, entry.startAngle + pad)}`,
    `A${RADIUS},${RADIUS} 0 ${large} 1 ${point(RADIUS, entry.endAngle - pad)}`,
    `L${point(HOLE, entry.endAngle - innerPad)}`,
    `A${HOLE},${HOLE} 0 ${large} 0 ${point(HOLE, entry.startAngle + innerPad)}`,
    'Z',
  ].join('');
};

/** The point on the outer edge in the middle of a slice, where the shipped tooltip anchors. */
export const sliceAnchor = (entry: PieEntry) => {
  const angle = (entry.startAngle + entry.endAngle) / 2;
  return { x: RADIUS + RADIUS * Math.sin(angle), y: RADIUS - RADIUS * Math.cos(angle) };
};

/** The shipped donut with its total; `hovered` draws one slice in the shipped hover tint. */
export const donut = (hovered: number | null = null, extra = '') => html`
  <div class="plot">
    <svg class="plot-svg" width="${SIZE}" height="${SIZE}">
      ${ENTRIES.map(
        (entry, index) =>
          html`<path
            class="slice"
            data-hovered="${index === hovered}"
            d="${arcPath(entry)}"
            style="--slice: ${entry.color}"
          />`,
      )}
    </svg>
    <div class="center">
      <strong class="total">${TOTAL_TEXT}</strong>
      <span>Total</span>
    </div>
    ${extra}
  </div>
`;

export const swatch = (entry: PieEntry) => html`<span class="swatch" style="--slice: ${entry.color}"></span>`;

/** The same chart twice: the full frame width, then a 300px container. */
export const containers = (chart: () => string) => html`
  <p class="caption">Wide container · ${WIDE_WIDTH}px</p>
  <div class="container" style="inline-size: ${WIDE_WIDTH}px">${chart()}</div>
  <p class="caption">Narrow container · ${NARROW_WIDTH}px</p>
  <div class="container" style="inline-size: ${NARROW_WIDTH}px">${chart()}</div>
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

  .caption {
    margin: 0 0 8px;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: ${MUTED};
  }

  .container {
    box-sizing: border-box;
    margin-block-end: 24px;
    padding-block: 12px;
    border-block: 1px dashed ${BORDER};
  }

  .plot {
    position: relative;
    flex: 0 1 auto;
    inline-size: ${SIZE}px;
    block-size: ${SIZE}px;
  }

  .plot-svg {
    display: block;
    overflow: visible;
  }

  .slice {
    fill: var(--slice);
  }

  .slice[data-hovered='true'] {
    fill: color-mix(in oklab, var(--slice) 85%, ${SURFACE});
  }

  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .total {
    font-size: 1.5em;
    line-height: 1.2;
    font-weight: 400;
    color: ${INK};
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    flex: none;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 2px;
    background: var(--slice);
  }

  .num {
    text-align: end;
    font-variant-numeric: tabular-nums;
  }

  .value {
    color: ${INK};
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
