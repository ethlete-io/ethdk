import barChartBase from '../src/lib/chart/bar-chart.component.css?inline';
import axisBase from '../src/lib/chart/chart-axis.component.css?inline';
import gridBase from '../src/lib/chart/chart-grid.component.css?inline';
import legendBase from '../src/lib/chart/chart-legend.component.css?inline';
import chartTooltipBase from '../src/lib/chart/chart-tooltip.component.css?inline';
import lineChartTooltipBase from '../src/lib/chart/line-chart-tooltip.component.css?inline';
import lineChartBase from '../src/lib/chart/line-chart.component.css?inline';
import pieChartBase from '../src/lib/chart/pie-chart.component.css?inline';
import { tooltip, tooltipStyles } from './tooltip';

export type ChartMockSeries = {
  label: string;
  values: readonly number[];
};

export type ChartMockMark = {
  /** The bar (in category, then series order), x or slice index. */
  index: number;
  /** A design marker for the mark, e.g. `hover` or `focus-visible`. */
  force?: 'hover' | 'focus-visible';
  /** Draws the mark's tooltip open, as on hover or tap. */
  tooltip?: boolean;
};

type ChartMockBase = {
  /** Left out, 400: the plot width the component would measure, in px. */
  plotWidth?: number;
  /** Left out, 240, the component default. */
  height?: number;
  mark?: ChartMockMark;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

export type BarChartMockOptions = ChartMockBase & {
  categories: readonly string[];
  /** One series draws no legend; two or more draw it, in accent mix steps. */
  series: readonly ChartMockSeries[];
  /** Projected `etBarChartEmpty` content; drawn when every value is missing. */
  empty?: string;
};

export type LineChartMockOptions = ChartMockBase & {
  categories: readonly string[];
  series: readonly ChartMockSeries[];
  points?: boolean;
};

export type PieChartMockOptions = {
  data: readonly { label: string; value: number }[];
  /** Left out, 200, the component default. */
  size?: number;
  /** The donut hole as a share of the radius; 0 draws a pie. */
  innerRadius?: number;
  totalLabel?: string;
  mark?: ChartMockMark;
  attributes?: string;
};

/** The stylesheets the chart mocks draw with: the real bar, line and pie chart, axis, grid, legend and tooltip CSS. */
export const chartStyles = /* @__PURE__ */ [
  tooltipStyles,
  axisBase,
  gridBase,
  legendBase,
  chartTooltipBase,
  lineChartTooltipBase,
  barChartBase,
  lineChartBase,
  pieChartBase,
  `@layer components {
  .et-chart-mock-plot {
    position: relative;
  }
  .et-chart-mock-tip {
    position: absolute;
    z-index: 1;
    inset-inline-start: var(--_et-chart-mock-tip-x);
    inset-block-start: var(--_et-chart-mock-tip-y);
    translate: -50% calc(-100% - 4px);
  }
  .et-chart-mock-tip[data-placement='right'] {
    translate: 4px -50%;
  }
  .et-chart-mock-tip[data-placement='left'] {
    translate: calc(-100% - 4px) -50%;
  }
  .et-chart-mock-tip[data-placement='bottom'] {
    translate: -50% 4px;
  }
}`,
].join('\n');

const BAR_GAP = 2;
const BAR_RADIUS = 4;
const MAX_BAR_WIDTH = 24;
const GROUP_PADDING = 0.2;
const MIN_ACCENT_MIX = 40;
const SLICE_GAP = 2;
const TAU = 6.283185307179586;

const round = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;

  return Object.is(rounded, -0) ? 0 : rounded;
};

const styled = (css: string) => ` style="${css}"`;

const accentMixes = (count: number) =>
  Array.from({ length: count }, (_, step) =>
    count < 2 ? null : Math.round(100 - (step * (100 - MIN_ACCENT_MIX)) / (count - 1)),
  );

const mixStyle = (mix: number | null, name = '--_et-chart-accent-mix') =>
  mix === null ? '' : styled(`${name}: ${mix}%`);

const niceTicks = (max: number, count = 5) => {
  if (!(max > 0)) return [0, 1];

  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((factor) => factor * magnitude >= raw) ?? 10) * magnitude;
  const top = Math.ceil(max / step) * step;

  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
};

const axis = (
  labels: readonly { text: string; position: number; extent?: number }[],
  {
    orientation,
    className,
    blockSize,
  }: { orientation: 'horizontal' | 'vertical'; className: string; blockSize?: number },
) => {
  const spans = labels
    .map((label) => {
      const vars = [
        `--_et-chart-axis-position: ${round(label.position)}px`,
        label.extent !== undefined && `--_et-chart-axis-extent: ${round(label.extent)}px`,
      ].filter(Boolean);

      return `<span class="et-chart-axis-label"${label.extent !== undefined ? ' data-extent=""' : ''}${styled(`${vars.join('; ')}`)}>${label.text}</span>`;
    })
    .join('');
  const size = blockSize === undefined ? '' : styled(`block-size: ${blockSize}px`);

  return `<et-chart-axis class="${className} et-chart-axis" aria-hidden="true" data-orientation="${orientation}"${size}>${spans}</et-chart-axis>`;
};

const grid = (ticks: readonly { value: number; position: number }[], length: number) =>
  `<g class="et-chart-grid" aria-hidden="true">${ticks
    .map(
      (tick) =>
        `<line x1="0" y1="${round(tick.position)}" x2="${length}" y2="${round(tick.position)}" class="et-chart-grid-line${tick.value === 0 ? ' et-chart-baseline' : ''}" shape-rendering="crispEdges"></line>`,
    )
    .join('')}</g>`;

const legend = (
  series: readonly ChartMockSeries[],
  { className, mark }: { className: string; mark: 'rect' | 'line' },
) => {
  const mixes = accentMixes(series.length);
  const items = series
    .map(
      (entry, index) =>
        `<li class="et-chart-legend-item"><span class="et-chart-legend-swatch et-color--inherited" aria-hidden="true"${mixStyle(mixes[index] ?? null)}></span><span class="et-chart-legend-label">${entry.label}</span></li>`,
    )
    .join('');

  return `<et-chart-legend class="${className} et-chart-legend et-color--inherited" data-mark="${mark}"><ul class="et-chart-legend-list">${items}</ul></et-chart-legend>`;
};

type TipAnchor = { x: number; y: number; placement: 'top' | 'right' | 'bottom' | 'left' };

const tip = (content: string, { x, y, placement }: TipAnchor) =>
  `<div class="et-chart-mock-tip" data-placement="${placement}"${styled(`--_et-chart-mock-tip-x: ${round(x)}px; --_et-chart-mock-tip-y: ${round(y)}px`)}>${tooltip({ content, placement })}</div>`;

const chartTooltip = ({
  value,
  label,
  series,
}: {
  value: string;
  label: string;
  series?: { label: string; mix: number | null };
}) => {
  const key = series
    ? `<span class="et-chart-tooltip-key et-color--inherited" aria-hidden="true"${mixStyle(series.mix)}></span>`
    : '';
  const seriesLabel = series ? `<span class="et-chart-tooltip-series">${series.label}</span>` : '';

  return `<et-chart-tooltip class="et-chart-tooltip">${key}<strong class="et-chart-tooltip-value">${value}</strong>${seriesLabel}<span class="et-chart-tooltip-label">${label}</span></et-chart-tooltip>`;
};

const markAttributes = (mark: ChartMockMark | undefined, index: number) =>
  mark?.index === index && mark.force ? ` data-et-force="${mark.force}"` : '';

const barPath = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => {
  if (width <= 0 || height <= 0) return '';

  const r = Math.min(BAR_RADIUS, width / 2, height);
  const right = round(x + width);
  const bottom = round(y + height);

  return `M${round(x)},${bottom}V${round(y + r)}A${r},${r} 0 0 1 ${round(x + r)},${round(y)}H${round(right - r)}A${r},${r} 0 0 1 ${right},${round(y + r)}V${bottom}Z`;
};

/** Draws an `et-bar-chart` (vertical, grouped) with the geometry the component computes for the given plot width, as HTML, without its visually hidden data table. Enter animations are drawn at rest. */
export const barChart = (options: BarChartMockOptions) => {
  const width = options.plotWidth ?? 400;
  const height = options.height ?? 240;
  const { categories, series, mark } = options;
  const values = series.flatMap((entry) => entry.values.filter((value) => Number.isFinite(value)));
  const isEmpty = !values.length;
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks[ticks.length - 1] ?? 1;
  const scale = (value: number) => height - (value / top) * height;
  const tickModels = ticks.map((value) => ({ value, position: scale(value) }));

  const groupSize = Math.max(1, series.length);
  const step = categories.length ? width / categories.length : 0;
  const groupGap = groupSize > 1 ? Math.max(BAR_GAP, step * GROUP_PADDING) : BAR_GAP;
  const innerGaps = (groupSize - 1) * BAR_GAP;
  const bandWidth = Math.max(0, Math.min(MAX_BAR_WIDTH, (step - groupGap - innerGaps) / groupSize));
  const groupWidth = bandWidth * groupSize + innerGaps;
  const bandStart = (index: number, member: number) =>
    index * step + (step - groupWidth) / 2 + member * (bandWidth + BAR_GAP);
  const mixes = accentMixes(series.length);

  let tipMarkup = '';
  let barIndex = 0;

  const bars = categories
    .flatMap((category, categoryIndex) =>
      series.map((entry, member) => {
        const value = entry.values[categoryIndex];

        if (value === undefined || !Number.isFinite(value)) return '';

        const index = barIndex++;
        const x = bandStart(categoryIndex, member);
        const y = scale(value);
        const slotStart = member === 0 ? categoryIndex * step : x - BAR_GAP / 2;
        const slotEnd = member === groupSize - 1 ? (categoryIndex + 1) * step : x + bandWidth + BAR_GAP / 2;
        const mix = series.length > 1 ? (mixes[member] ?? null) : null;
        const name = series.length > 1 ? `${category}, ${entry.label}` : category;

        if (mark?.index === index && mark.tooltip) {
          tipMarkup = tip(
            chartTooltip({
              value: `${value}`,
              label: category,
              series: series.length > 1 ? { label: entry.label, mix } : undefined,
            }),
            { x: x + bandWidth / 2, y, placement: 'top' },
          );
        }

        return `<g class="et-bar-chart-bar et-color--inherited" tabindex="0" role="img" aria-label="${name}"${mixStyle(mix)}${markAttributes(mark, index)}><rect x="${round(slotStart)}" y="0" width="${round(slotEnd - slotStart)}" height="${height}" class="et-bar-chart-bar-target" rx="4"></rect><path d="${barPath({ x, y, width: bandWidth, height: height - y })}" class="et-bar-chart-bar-mark"></path><rect x="${round(x)}" y="${round(y)}" width="${round(bandWidth)}" height="0" class="et-bar-chart-bar-anchor"></rect></g>`;
      }),
    )
    .join('');

  const svg = `<svg width="${width}" height="${height}" aria-label="Bar chart" class="et-bar-chart-svg" role="group"${styled(`--_et-bar-chart-baseline: ${height}px`)}>${grid(tickModels, width)}<g class="et-bar-chart-bars et-color--inherited">${bars}</g></svg>`;
  const valueAxis = axis(
    isEmpty ? [] : tickModels.map((tick) => ({ text: `${tick.value}`, position: tick.position })),
    { orientation: 'vertical', className: 'et-bar-chart-value-axis', blockSize: height },
  );
  const categoryAxis = axis(
    categories.map((text, index) => ({ text, position: index * step + step / 2, extent: step })),
    { orientation: 'horizontal', className: 'et-bar-chart-category-axis' },
  );
  const empty = isEmpty
    ? `<div class="et-bar-chart-empty"${styled(`block-size: ${height}px`)}><span etBarChartEmpty>${options.empty ?? ''}</span></div>`
    : '';
  const legendMarkup = series.length > 1 ? legend(series, { className: 'et-bar-chart-legend', mark: 'rect' }) : '';
  const host = [options.attributes, 'class="et-bar-chart"'].filter(Boolean);

  return `<et-bar-chart ${host.join(' ')}>${legendMarkup}<div class="et-bar-chart-figure" data-orientation="vertical">${valueAxis}<div class="et-bar-chart-plot et-chart-mock-plot"${styled(`block-size: ${height}px`)}>${svg}${tipMarkup}</div>${empty}${categoryAxis}</div></et-bar-chart>`;
};

/** Draws an `et-line-chart` on a category scale with the geometry the component computes for the given plot width, as HTML, without its visually hidden data table. The reveal animation is drawn at rest. */
export const lineChart = (options: LineChartMockOptions) => {
  const width = options.plotWidth ?? 400;
  const height = options.height ?? 240;
  const { categories, series, mark } = options;
  const ticks = niceTicks(Math.max(0, ...series.flatMap((entry) => entry.values)));
  const top = ticks[ticks.length - 1] ?? 1;
  const scale = (value: number) => height - (value / top) * height;
  const tickModels = ticks.map((value) => ({ value, position: scale(value) }));
  const step = categories.length ? width / categories.length : 0;
  const positions = categories.map((_, index) => index * step + step / 2);
  const mixes = accentMixes(series.length);

  const lines = series
    .map((entry, seriesIndex) => {
      const points = entry.values.map((value, index) => ({ x: positions[index] ?? 0, y: scale(value) }));
      const path = points.map((point, index) => `${index ? 'L' : 'M'}${round(point.x)},${round(point.y)}`).join('');
      const dots = options.points
        ? points
            .map(
              (point) =>
                `<circle cx="${round(point.x)}" cy="${round(point.y)}" class="et-line-chart-point" r="5"></circle>`,
            )
            .join('')
        : '';

      return `<g class="et-line-chart-series et-color--inherited"${mixStyle(mixes[seriesIndex] ?? null)}><path d="${path}" class="et-line-chart-line"></path>${dots}</g>`;
    })
    .join('');

  let tipMarkup = '';

  const slices = categories
    .map((category, index) => {
      const position = positions[index] ?? 0;
      const start = index === 0 ? 0 : (position + (positions[index - 1] ?? 0)) / 2;
      const end = index === categories.length - 1 ? width : (position + (positions[index + 1] ?? width)) / 2;
      const entries = series.map((entry, seriesIndex) => ({
        label: entry.label,
        value: entry.values[index] ?? 0,
        y: scale(entry.values[index] ?? 0),
        mix: mixes[seriesIndex] ?? null,
      }));
      const anchorY = Math.min(...entries.map((entry) => entry.y));
      const isActive = mark?.index === index && mark.tooltip;
      const dots = entries
        .map(
          (entry) =>
            `<circle cx="${round(position)}" cy="${round(entry.y)}" class="et-line-chart-slice-point et-color--inherited" r="5"${mixStyle(entry.mix)}></circle>`,
        )
        .join('');
      const vars = `--_et-line-chart-slice-x: ${round(start)}px; --_et-line-chart-slice-width: ${round(end - start)}px; --_et-line-chart-slice-position: ${round(position)}px`;

      if (isActive) {
        const rows = entries
          .map(
            (entry) =>
              `<li class="et-line-chart-tooltip-row et-color--inherited"${mixStyle(entry.mix)}><span class="et-line-chart-tooltip-key" aria-hidden="true"></span><span class="et-line-chart-tooltip-series">${entry.label}</span><strong class="et-line-chart-tooltip-value">${entry.value}</strong></li>`,
          )
          .join('');
        const content =
          series.length > 1
            ? `<et-line-chart-tooltip class="et-line-chart-tooltip"><span class="et-line-chart-tooltip-label">${category}</span><ul class="et-line-chart-tooltip-list">${rows}</ul></et-line-chart-tooltip>`
            : chartTooltip({ value: `${entries[0]?.value ?? ''}`, label: category });

        tipMarkup = tip(content, { x: position, y: anchorY, placement: 'top' });
      }

      return `<g class="et-line-chart-slice" tabindex="0" role="img" aria-label="${category}"${isActive ? ' data-active=""' : ''}${markAttributes(mark, index)}><rect x="${round(start)}" y="0" width="${round(end - start)}" height="${height}" class="et-line-chart-slice-target" rx="4"></rect><rect x="${round(start)}" y="0" width="${round(end - start)}" height="${height}" class="et-line-chart-focus-ring" rx="4"${styled(`${vars}`)}></rect><line x1="${round(position)}" x2="${round(position)}" y1="0" y2="${height}" class="et-line-chart-crosshair" shape-rendering="crispEdges"></line>${dots}<rect x="${round(position)}" y="${round(anchorY)}" width="0" height="0" class="et-line-chart-slice-anchor"></rect></g>`;
    })
    .join('');

  const svg = `<svg width="${width}" height="${height}" aria-label="Line chart" class="et-line-chart-svg" role="group"${options.points ? ' data-points=""' : ''}>${grid(tickModels, width)}<g class="et-line-chart-series-layer et-color--inherited" aria-hidden="true">${lines}</g><g class="et-line-chart-slices et-color--inherited">${slices}</g></svg>`;
  const valueAxis = axis(
    tickModels.map((tick) => ({ text: `${tick.value}`, position: tick.position })),
    { orientation: 'vertical', className: 'et-line-chart-value-axis', blockSize: height },
  );
  const xAxis = axis(
    categories.map((text, index) => ({ text, position: positions[index] ?? 0, extent: step })),
    { orientation: 'horizontal', className: 'et-line-chart-x-axis' },
  );
  const legendMarkup = series.length > 1 ? legend(series, { className: 'et-line-chart-legend', mark: 'line' }) : '';
  const host = [options.attributes, 'class="et-line-chart"'].filter(Boolean);

  return `<et-line-chart ${host.join(' ')}>${legendMarkup}<div class="et-line-chart-figure" data-scale="category">${valueAxis}<div class="et-line-chart-plot et-chart-mock-plot"${styled(`block-size: ${height}px`)}>${svg}${tipMarkup}</div>${xAxis}</div></et-line-chart>`;
};

const arcPoint = (center: number, { radius, angle }: { radius: number; angle: number }) =>
  `${round(center + radius * Math.sin(angle))},${round(center - radius * Math.cos(angle))}`;

type ArcOptions = { radius: number; inner: number; startAngle: number; endAngle: number; gap: number };

const arcPath = ({ radius, inner, startAngle, endAngle, gap }: ArcOptions) => {
  const sweep = endAngle - startAngle;
  const c = radius;

  if (sweep >= TAU - 1e-9) {
    const circle = (r: number, dir: 0 | 1) =>
      `M${c},${round(c - r)}A${round(r)},${round(r)} 0 1 ${dir} ${c},${round(c + r)}A${round(r)},${round(r)} 0 1 ${dir} ${c},${round(c - r)}Z`;

    return inner > 0 ? `${circle(radius, 1)}${circle(inner, 0)}` : circle(radius, 1);
  }

  const minSweep = Math.min(sweep, 1 / radius);
  const outerPad = Math.max(0, Math.min(Math.asin(Math.min(1, gap / 2 / radius)), (sweep - minSweep) / 2));
  const halfGap = radius * Math.sin(outerPad);
  const r = round(radius);
  const outerArc = `M${arcPoint(c, { radius, angle: startAngle + outerPad })}A${r},${r} 0 ${sweep - 2 * outerPad > Math.PI ? 1 : 0} 1 ${arcPoint(c, { radius, angle: endAngle - outerPad })}`;
  const apexDistance = halfGap > 0 ? halfGap / Math.sin(sweep / 2) : 0;

  if (inner <= apexDistance) {
    return `${outerArc}L${arcPoint(c, { radius: Math.min(apexDistance, radius), angle: (startAngle + endAngle) / 2 })}Z`;
  }

  const innerPad = Math.asin(Math.min(1, halfGap / inner));
  const ri = round(inner);

  return `${outerArc}L${arcPoint(c, { radius: inner, angle: endAngle - innerPad })}A${ri},${ri} 0 ${sweep - 2 * innerPad > Math.PI ? 1 : 0} 0 ${arcPoint(c, { radius: inner, angle: startAngle + innerPad })}Z`;
};

const placementForAngle = (angle: number) => {
  const degrees = (((angle % TAU) + TAU) % TAU) * (180 / Math.PI);

  if (degrees < 45 || degrees >= 315) return 'top';
  if (degrees < 135) return 'right';
  if (degrees < 225) return 'bottom';

  return 'left';
};

const wholePercentages = (values: readonly number[]) => {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);

  if (!(total > 0)) return values.map(() => 0);

  const exact = values.map((value) => (Math.max(0, value) / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (remaining-- > 0) floors[index] = (floors[index] ?? 0) + 1;
    });

  return floors;
};

/** Draws an `et-pie-chart` (pie or donut) with its legend and the geometry the component computes, as HTML, without its visually hidden data table. Enter animations are drawn at rest. */
export const pieChart = (options: PieChartMockOptions) => {
  const diameter = options.size ?? 200;
  const radius = diameter / 2;
  const hole = radius * Math.min(0.9, Math.max(0, options.innerRadius ?? 0));
  const { data, mark } = options;
  const total = data.reduce((sum, datum) => sum + Math.max(0, datum.value), 0);
  const percents = wholePercentages(data.map((datum) => datum.value));
  const mixes = accentMixes(data.length);
  const drawn = data.map((datum, index) => ({ datum, index })).filter(({ datum }) => datum.value > 0);
  const gap = drawn.length > 1 ? SLICE_GAP : 0;

  let angle = 0;
  let tipMarkup = '';

  const slices =
    total > 0
      ? drawn
          .map(({ datum, index }, order) => {
            const start = angle;
            const end = drawn.length === 1 ? TAU : angle + (datum.value / total) * TAU;
            const mid = drawn.length === 1 ? 0 : (start + end) / 2;

            angle = end;

            const style = [
              mixes[index] !== null && `--_et-pie-chart-accent-mix: ${mixes[index]}%`,
              `--_et-pie-chart-slice-order: ${order}`,
            ].filter(Boolean);
            const anchorX = radius + radius * Math.sin(mid);
            const anchorY = radius - radius * Math.cos(mid);

            if (mark?.index === index && mark.tooltip) {
              tipMarkup = tip(
                chartTooltip({ value: `${datum.value}`, label: `${datum.label} · ${percents[index]}%` }),
                { x: anchorX, y: anchorY, placement: placementForAngle(mid) },
              );
            }

            return `<g class="et-pie-chart-slice et-color--inherited" tabindex="0" role="img" aria-label="${datum.label}"${styled(`${style.join('; ')}`)}${markAttributes(mark, index)}><path d="${arcPath({ radius, inner: hole, startAngle: start, endAngle: end, gap })}" class="et-pie-chart-slice-mark"></path><rect x="${round(anchorX)}" y="${round(anchorY)}" width="0" height="0" class="et-pie-chart-slice-anchor"></rect></g>`;
          })
          .join('')
      : `<circle cx="${radius}" cy="${radius}" r="${radius - 0.5}" class="et-pie-chart-empty"></circle>`;

  const center =
    hole > 0
      ? `<div class="et-pie-chart-center"${styled(`--_et-pie-chart-hole-size: ${round(hole * 2)}px`)}><strong class="et-pie-chart-total">${total}</strong><span class="et-pie-chart-total-label">${options.totalLabel ?? 'Total'}</span></div>`
      : '';
  const legendItems = data
    .map(
      (datum, index) =>
        `<li class="et-pie-chart-legend-item et-color--inherited"${mixStyle(mixes[index] ?? null, '--_et-pie-chart-accent-mix')}><span class="et-pie-chart-legend-swatch" aria-hidden="true"></span><span class="et-pie-chart-legend-label">${datum.label}</span><span class="et-pie-chart-legend-value">${datum.value}</span><span class="et-pie-chart-legend-percent">${percents[index]}%</span></li>`,
    )
    .join('');
  const host = [options.attributes, 'class="et-pie-chart"'].filter(Boolean);

  return `<et-pie-chart ${host.join(' ')}><div class="et-pie-chart-figure et-color--inherited"><div class="et-pie-chart-plot et-chart-mock-plot"${styled(`inline-size: ${diameter}px`)}><svg width="${diameter}" height="${diameter}" aria-label="Pie chart" class="et-pie-chart-svg" role="group">${slices}</svg>${center}${tipMarkup}</div><ul class="et-pie-chart-legend">${legendItems}</ul></div></et-pie-chart>`;
};
