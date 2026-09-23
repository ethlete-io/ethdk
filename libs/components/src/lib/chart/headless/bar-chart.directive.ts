import { computed, Directive, effect, input, numberAttribute, signal } from '@angular/core';
import { injectColorPalette, injectLocale, RegisteredColorThemeName } from '@ethlete/core';
import {
  ChartAxisLabel,
  ChartLegendItem,
  ChartRect,
  ChartTableModel,
  ChartTick,
  ChartTooltipPlacement,
} from '../chart.types';
import { CHART_PLOT_HOST, ChartPlotDirective, ChartPlotHost } from './chart-plot.directive';
import { assertChartPlot } from './internals/chart-plot-check';
import { ChartValueFormatter, resolveChartValueFormatter } from './internals/chart-format';
import { createBandScale, createBarPath, createLinearScale, createValueTicks } from './internals/chart-scale';
import { hasSharedSeriesColor, resolveChartSeriesColors } from './internals/chart-series';
import { ChartStackSegment, stackExtent, stackValues } from './internals/chart-stack';

/** One bar of a single-series chart: a category and the value its bar encodes. */
export type BarChartDatum = {
  label: string;
  value: number;
};

/** One category of a multi-series chart: its label and a value per series `key`. A missing value draws no bar. */
export type BarChartSeriesDatum = {
  label: string;
  values: Readonly<Record<string, number | null | undefined>>;
};

/** A series of a multi-series chart. Its values are read from each datum's `values[key]`. */
export type BarChartSeries = {
  key: string;
  /** Names the series in the legend, the tooltip, the bar's accessible name and the table header. */
  label: string;
  /** The color theme the series is drawn in. @default the palette entry at the series' position, else the accent */
  colorToken?: RegisteredColorThemeName | null;
};

/** How several series share a category: side by side, or stacked on one bar. */
export type BarChartLayout = 'grouped' | 'stacked';

/** Which way the bars grow: up from a horizontal baseline, or right from a vertical one. */
export type BarChartOrientation = 'vertical' | 'horizontal';

/** Formats a value for the axis, the tooltip and the table. */
export type BarChartValueFormatter = ChartValueFormatter;

/** A bar with its geometry in plot pixels, ready to render. */
export type BarChartBar = {
  /** Unique per category and series, stable across data updates. */
  key: string;
  /** The category label and this bar's value. */
  datum: BarChartDatum;
  /** Position in {@link BarChartDirective.bars} - category by category, series by series. */
  index: number;
  categoryIndex: number;
  seriesIndex: number;
  /** The series this bar belongs to; `null` in a single-series chart. */
  series: BarChartSeries | null;
  /** The color theme the bar is drawn in; `null` takes the surrounding accent. */
  colorToken: RegisteredColorThemeName | null;
  /** Left edge of the bar's hit target - its share of the category band. */
  slotX: number;
  slotWidth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The mark's outline: rounded at the data end, square at the baseline and between stacked segments. */
  path: string;
  /** Whether the bar grows from the baseline towards negative values - down, or left when horizontal. */
  isNegative: boolean;
  /** The hover, tap and focus target. Larger than the mark. */
  target: ChartRect;
  /** A zero-size rect at the bar's data end, for the tooltip to point at. */
  anchor: ChartRect;
  /** The side of `anchor` the tooltip opens on. */
  placement: ChartTooltipPlacement;
  valueText: string;
  /** The bar's accessible name: the category, plus the series in a multi-series chart, e.g. `"Mar, Home"`. */
  name: string;
  /** What assistive tech reads for the bar, e.g. `"Mar, Home: 1,200"`. */
  ariaLabel: string;
};

/**
 * A value-axis tick. `position` is its offset along the value axis; `x` and `y` are where it meets
 * that axis - `y` in a vertical chart, `x` in a horizontal one.
 */
export type BarChartTick = ChartTick & {
  x: number;
  y: number;
};

type NormalizedCategory = {
  label: string;
  values: (number | null)[];
  datum?: BarChartDatum;
};

const BAR_GAP = 2;
const BAR_RADIUS = 4;

const finiteOrNull = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Headless bar chart: turns `data` into bar geometry, value-axis ticks, legend entries and the strings
 * a table view needs. One series by default; pass `series` for grouped or stacked bars. It measures
 * nothing itself - the element marked `etChartPlot` reports the width the bars are laid out in.
 *
 * @example
 * <div etBarChart [data]="data" label="Sign-ups per month">
 *   <div etChartPlot><svg>…</svg></div>
 * </div>
 */
@Directive({
  selector: '[etBarChart]',
  exportAs: 'etBarChart',
  providers: [{ provide: CHART_PLOT_HOST, useExisting: BarChartDirective }],
})
export class BarChartDirective implements ChartPlotHost {
  private palette = injectColorPalette({ optional: true });
  private locale = injectLocale();

  /**
   * The categories, in order. `{ label, value }` per bar for one series; with `series`,
   * `{ label, values }` holding a value per series key.
   */
  public data = input.required<readonly BarChartDatum[] | readonly BarChartSeriesDatum[]>();

  /** The series to draw from each datum's `values`. Empty draws one series from each datum's `value`. @default [] */
  public series = input<readonly BarChartSeries[]>([]);

  /** How several series share a category. @default 'grouped' */
  public layout = input<BarChartLayout>('grouped');

  /** Which way the bars grow. @default 'vertical' */
  public orientation = input<BarChartOrientation>('vertical');

  /** Names the chart for assistive tech and captions its table view. */
  public label = input.required<string>();

  /** Height of the plot area in px, excluding the axis labels. @default 240 */
  public height = input(240, { transform: numberAttribute });

  /** Roughly how many value-axis intervals to draw; the axis rounds to a clean 1, 2 or 5 step. @default 5 */
  public tickCount = input(5, { transform: numberAttribute });

  /** The thickest a bar may get in px. Wider bands keep the rest as air. @default 24 */
  public maxBarWidth = input(24, { transform: numberAttribute });

  /** Formats values for the axis, the tooltip and the table. @default the app locale's number format */
  public valueFormatter = input<BarChartValueFormatter | null>(null);

  /** The table view's category column header. @default 'Category' */
  public categoryHeader = input('Category');

  /** The table view's value column header in a single-series chart. @default 'Value' */
  public valueHeader = input('Value');

  public formatValue = computed(() => resolveChartValueFormatter(this.valueFormatter(), this.locale.currentLocale()));

  /**
   * The element the bars are laid out in. Set by `etChartPlot`.
   *
   * @internal
   */
  public plot = signal<ChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  public isHorizontal = computed(() => this.orientation() === 'horizontal');

  public isStacked = computed(() => this.layout() === 'stacked' && this.series().length > 1);

  /** The color theme per entry of `series`, resolved against the palette. */
  public seriesColors = computed(() => resolveChartSeriesColors(this.series(), this.palette));

  /** The legend entries - one per series when there are two or more, else none. */
  public legendItems = computed<ChartLegendItem[]>(() => {
    const series = this.series();
    const colors = this.seriesColors();

    if (series.length < 2) return [];

    return series.map((entry, index) => ({ key: entry.key, label: entry.label, colorToken: colors[index] ?? null }));
  });

  private categories = computed<NormalizedCategory[]>(() => {
    const series = this.series();

    if (!series.length) {
      return (this.data() as readonly BarChartDatum[]).map((datum) => ({
        label: datum.label,
        values: [Number.isFinite(datum.value) ? datum.value : 0],
        datum,
      }));
    }

    return (this.data() as readonly BarChartSeriesDatum[]).map((datum) => ({
      label: datum.label,
      values: series.map((entry) => finiteOrNull(datum.values?.[entry.key])),
    }));
  });

  public valueTicks = computed(() => {
    const categories = this.categories();
    const values = this.isStacked()
      ? stackExtent(categories.map((category) => category.values))
      : categories.flatMap((category) => category.values.filter((value) => value !== null));

    return createValueTicks(values, this.tickCount());
  });

  private valueLength = computed(() => (this.isHorizontal() ? this.plotWidth() : this.height()));

  private valueScale = computed(() =>
    createLinearScale(this.valueTicks().domain, this.isHorizontal() ? [0, this.plotWidth()] : [this.height(), 0]),
  );

  /** The zero line's offset along the value axis, in plot pixels. */
  public baseline = computed(() => this.valueScale()(0));

  /** @deprecated Use `baseline`, which also covers horizontal charts. */
  public baselineY = this.baseline;

  public ticks = computed<BarChartTick[]>(() => {
    const scale = this.valueScale();
    const format = this.formatValue();
    const horizontal = this.isHorizontal();
    const height = this.height();

    return this.valueTicks().ticks.map((value) => {
      const position = scale(value);

      return { value, text: format(value), position, x: horizontal ? position : 0, y: horizontal ? height : position };
    });
  });

  private bandScale = computed(() =>
    createBandScale({
      count: this.categories().length,
      width: this.isHorizontal() ? this.height() : this.plotWidth(),
      maxBandWidth: this.maxBarWidth(),
      gap: BAR_GAP,
      groupSize: this.isStacked() ? 1 : Math.max(1, this.series().length),
    }),
  );

  /** The category labels, centered on their bands along the category axis. */
  public categoryLabels = computed<ChartAxisLabel[]>(() => {
    const band = this.bandScale();

    return this.categories().map((category, index) => ({
      key: index,
      text: category.label,
      position: index * band.step + band.step / 2,
      extent: band.step,
    }));
  });

  /** The value-axis labels, at their ticks. */
  public valueLabels = computed<ChartAxisLabel[]>(() =>
    this.ticks().map((tick) => ({ key: tick.value, text: tick.text, position: tick.position })),
  );

  public bars = computed<BarChartBar[]>(() => {
    const categories = this.categories();
    const series = this.series();
    const colors = this.seriesColors();
    const stacked = this.isStacked();
    const horizontal = this.isHorizontal();
    const scale = this.valueScale();
    const format = this.formatValue();
    const baseline = this.baseline();
    const band = this.bandScale();
    const valueLength = this.valueLength();
    const bars: BarChartBar[] = [];

    categories.forEach((category, categoryIndex) => {
      const segments: (ChartStackSegment | null)[] = stacked
        ? stackValues(category.values)
        : category.values.map((value) => (value === null ? null : { start: 0, end: value, isOuter: true }));

      segments.forEach((segment, seriesIndex) => {
        const value = category.values[seriesIndex];

        if (!segment || value === null || value === undefined) return;
        if (stacked && value === 0) return;

        const entry = series[seriesIndex] ?? null;
        const isNegative = value < 0;
        const member = stacked ? 0 : seriesIndex;
        const bandStart = band.bandStart(categoryIndex, member);
        const slot = band.memberSlot(categoryIndex, member);
        const distance = (v: number) => Math.abs(scale(v) - baseline);
        const toPixel = (d: number) => (horizontal !== isNegative ? baseline + d : baseline - d);

        const innerTrim = segment.start !== 0 ? BAR_GAP / 2 : 0;
        const outerTrim = segment.isOuter ? 0 : BAR_GAP / 2;
        const near = distance(segment.start) + innerTrim;
        const far = Math.max(near, distance(segment.end) - outerTrim);
        const valueStart = Math.min(toPixel(near), toPixel(far));
        const valueSize = far - near;

        const targetNear = toPixel(distance(segment.start));
        const targetFar = segment.isOuter
          ? horizontal !== isNegative
            ? valueLength
            : 0
          : toPixel(distance(segment.end));
        const targetStart = Math.min(targetNear, targetFar);
        const targetSize = stacked ? Math.abs(targetFar - targetNear) : valueLength;

        const rect: ChartRect = horizontal
          ? { x: valueStart, y: bandStart, width: valueSize, height: band.bandWidth }
          : { x: bandStart, y: valueStart, width: band.bandWidth, height: valueSize };

        const target: ChartRect = horizontal
          ? { x: stacked ? targetStart : 0, y: slot.start, width: targetSize, height: slot.size }
          : { x: slot.start, y: stacked ? targetStart : 0, width: slot.size, height: targetSize };

        const anchor: ChartRect = horizontal
          ? { x: isNegative ? rect.x : rect.x + rect.width, y: rect.y, width: 0, height: rect.height }
          : { x: rect.x, y: isNegative ? rect.y + rect.height : rect.y, width: rect.width, height: 0 };

        const roundedEnd = !segment.isOuter
          ? 'none'
          : horizontal
            ? isNegative
              ? 'left'
              : 'right'
            : isNegative
              ? 'bottom'
              : 'top';

        const valueText = format(category.datum?.value ?? value);
        const name = entry && series.length > 1 ? `${category.label}, ${entry.label}` : category.label;

        bars.push({
          key: `${categoryIndex}:${entry?.key ?? ''}`,
          datum: category.datum ?? { label: category.label, value },
          index: bars.length,
          categoryIndex,
          seriesIndex,
          series: entry,
          colorToken: entry ? (colors[seriesIndex] ?? null) : null,
          slotX: target.x,
          slotWidth: target.width,
          ...rect,
          path: createBarPath({ ...rect, radius: BAR_RADIUS, roundedEnd }),
          isNegative,
          target,
          anchor,
          placement: horizontal ? (isNegative ? 'left' : 'right') : isNegative ? 'bottom' : 'top',
          valueText,
          name,
          ariaLabel: `${name}: ${valueText}`,
        });
      });
    });

    return bars;
  });

  /** The data as a table: a row per category, a column per series. */
  public table = computed<ChartTableModel>(() => {
    const series = this.series();
    const format = this.formatValue();

    if (!series.length) {
      return {
        columns: [this.categoryHeader(), this.valueHeader()],
        rows: (this.data() as readonly BarChartDatum[]).map((datum) => ({
          header: datum.label,
          cells: [format(datum.value)],
        })),
      };
    }

    return {
      columns: [this.categoryHeader(), ...series.map((entry) => entry.label)],
      rows: this.categories().map((category) => ({
        header: category.label,
        cells: category.values.map((value) => (value === null ? '' : format(value))),
      })),
    };
  });

  constructor() {
    assertChartPlot(this, 'BarChartDirective');

    if (ngDevMode) {
      effect(() => {
        const colors = this.seriesColors();

        if (colors.length > 1 && hasSharedSeriesColor(colors)) {
          console.warn(
            '[BarChartDirective] Two or more series share one color. Provide a palette with provideColorPalette() ' +
              'or give each series its own colorToken.',
          );
        }
      });
    }
  }
}
