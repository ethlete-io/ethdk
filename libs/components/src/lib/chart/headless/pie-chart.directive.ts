import { computed, Directive, effect, input, numberAttribute, signal } from '@angular/core';
import { injectColorPalette, injectLocale, RegisteredColorThemeName, RuntimeError } from '@ethlete/core';
import { ChartTableModel, ChartTooltipPlacement } from '../chart.types';
import { PIE_CHART_ERROR_CODES } from '../pie-chart-errors';
import { CHART_PLOT_HOST, ChartPlotDirective, ChartPlotHost } from './chart-plot.directive';
import {
  ChartPoint,
  createArcPath,
  createArcPoint,
  createWholePercentages,
  placementForAngle,
} from './internals/chart-arc';
import { ChartValueFormatter, resolveChartValueFormatter } from './internals/chart-format';
import { assertChartPlot } from './internals/chart-plot-check';
import { resolveChartSeriesColors } from './internals/chart-series';

/** One slice of a pie chart: its label and the non-negative value its angle encodes. */
export type PieChartDatum = {
  label: string;
  value: number;
  /** The color theme the slice is drawn in. @default the palette entry at the slice's position, else a step of the accent */
  colorToken?: RegisteredColorThemeName | null;
};

/** Formats a value for the legend, the tooltip, the centre total and the table. */
export type PieChartValueFormatter = ChartValueFormatter;

/** A datum with its share of the total, as the legend and the table list it. */
export type PieChartEntry = {
  key: string;
  datum: PieChartDatum;
  /** Position in `data`. */
  index: number;
  /** The color theme the slice is drawn in; `null` takes the surrounding accent at `accentMix`. */
  colorToken: RegisteredColorThemeName | null;
  /** How much of the accent a slice without a color theme is mixed with the surface, in percent; `null` for a slice with one. */
  accentMix: number | null;
  /** The whole-number share of the total. The shares of all entries add up to 100. */
  percent: number;
  valueText: string;
  percentText: string;
};

/** A drawn slice with its geometry in plot pixels, ready to render. Entries with a value of 0 draw none. */
export type PieChartSlice = PieChartEntry & {
  /** Clockwise from 12 o'clock, in radians. */
  startAngle: number;
  endAngle: number;
  path: string;
  /** The midpoint of the slice's outer arc, for the tooltip to point at. */
  anchor: ChartPoint;
  /** The side of `anchor` the tooltip opens on - the side of the circle the slice sits on. */
  placement: ChartTooltipPlacement;
  /** The slice's accessible name: its label. */
  name: string;
  /** What assistive tech reads as the slice's description, e.g. `"1,240 (32%)"`. */
  description: string;
};

const SLICE_GAP = 2;
const MAX_INNER_RADIUS = 0.9;
const MIN_ACCENT_MIX = 40;

const drawnValue = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

const accentMixSteps = (count: number) =>
  Array.from({ length: count }, (_, step) =>
    count < 2 ? 100 : Math.round(100 - (step * (100 - MIN_ACCENT_MIX)) / (count - 1)),
  );

/**
 * Headless pie and donut chart: turns `data` into slice outlines, legend entries with shares, and the
 * strings a table view needs. Slices keep the order of `data`, clockwise from 12 o'clock. The element
 * marked `etChartPlot` reports the width the circle is fitted in.
 *
 * @example
 * <div etPieChart [data]="data" label="Traffic by channel">
 *   <div etChartPlot><svg>…</svg></div>
 * </div>
 */
@Directive({
  selector: '[etPieChart]',
  exportAs: 'etPieChart',
  providers: [{ provide: CHART_PLOT_HOST, useExisting: PieChartDirective }],
})
export class PieChartDirective implements ChartPlotHost {
  private palette = injectColorPalette({ optional: true });
  private locale = injectLocale();

  /** The slices, in drawing order. A value of 0 draws no slice; a negative value counts as 0. */
  public data = input.required<readonly PieChartDatum[]>();

  /** Names the chart for assistive tech and captions its table view. */
  public label = input.required<string>();

  /** The largest the circle's diameter may get in px. A narrower plot shrinks it. @default 200 */
  public size = input(200, { transform: numberAttribute });

  /** The hole of a donut, as a share of the radius from `0` (a pie) to `0.9`. @default 0 */
  public innerRadius = input(0, { transform: numberAttribute });

  /** Formats values for the legend, the tooltip, the centre total and the table. @default the app locale's number format */
  public valueFormatter = input<PieChartValueFormatter | null>(null);

  /** The table view's category column header. @default 'Category' */
  public categoryHeader = input('Category');

  /** The table view's value column header. @default 'Value' */
  public valueHeader = input('Value');

  /** The table view's share column header. @default 'Share' */
  public shareHeader = input('Share');

  public formatValue = computed(() => resolveChartValueFormatter(this.valueFormatter(), this.locale.currentLocale()));

  private formatPercent = computed(() => {
    const format = new Intl.NumberFormat(this.locale.currentLocale(), { style: 'percent' });

    return (percent: number) => format.format(percent / 100);
  });

  /**
   * The element the circle is fitted in. Set by `etChartPlot`.
   *
   * @internal
   */
  public plot = signal<ChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  /** The circle's diameter in px: `size`, or the plot's width when that is narrower. */
  public diameter = computed(() => Math.floor(Math.max(0, Math.min(this.size(), this.plotWidth()))));

  public radius = computed(() => this.diameter() / 2);

  /** The radius of the donut hole in px; 0 for a pie. */
  public holeRadius = computed(() => {
    const ratio = Math.min(MAX_INNER_RADIUS, Math.max(0, this.innerRadius() || 0));

    return this.radius() * ratio;
  });

  public isDonut = computed(() => this.innerRadius() > 0);

  /** The sum of every drawn value. */
  public total = computed(() => this.data().reduce((sum, datum) => sum + drawnValue(datum.value), 0));

  public totalText = computed(() => this.formatValue()(this.total()));

  /** Every datum with its color and share, in `data` order - including the ones that draw no slice. */
  public entries = computed<PieChartEntry[]>(() => {
    const data = this.data();
    const colors = resolveChartSeriesColors(data, this.palette);
    const uncovered = colors.filter((color) => color === null).length;
    const mixes = data.length > 1 ? accentMixSteps(uncovered) : [];
    const percents = createWholePercentages(data.map((datum) => datum.value));
    const format = this.formatValue();
    const formatPercent = this.formatPercent();
    let uncoveredIndex = 0;

    return data.map((datum, index) => {
      const colorToken = colors[index] ?? null;
      const percent = percents[index] ?? 0;

      return {
        key: `${index}:${datum.label}`,
        datum,
        index,
        colorToken,
        accentMix: colorToken === null ? (mixes[uncoveredIndex++] ?? null) : null,
        percent,
        valueText: format(datum.value),
        percentText: formatPercent(percent),
      };
    });
  });

  public slices = computed<PieChartSlice[]>(() => {
    const entries = this.entries();
    const total = this.total();
    const radius = this.radius();
    const holeRadius = this.holeRadius();

    if (!(total > 0) || !(radius > 0)) return [];

    const drawn = entries.filter((entry) => drawnValue(entry.datum.value) > 0);
    const gap = drawn.length > 1 ? SLICE_GAP : 0;
    let angle = 0;

    return drawn.map((entry) => {
      const startAngle = angle;
      const endAngle = drawn.length === 1 ? Math.PI * 2 : angle + (drawnValue(entry.datum.value) / total) * Math.PI * 2;
      const midAngle = drawn.length === 1 ? 0 : (startAngle + endAngle) / 2;

      angle = endAngle;

      return {
        ...entry,
        startAngle,
        endAngle,
        path: createArcPath({
          cx: radius,
          cy: radius,
          outerRadius: radius,
          innerRadius: holeRadius,
          startAngle,
          endAngle,
          gap,
        }),
        anchor: createArcPoint({ x: radius, y: radius }, { radius, angle: midAngle }),
        placement: placementForAngle(midAngle),
        name: entry.datum.label,
        description: `${entry.valueText} (${entry.percentText})`,
      };
    });
  });

  /** The data as a table: a row per datum with its value and share. */
  public table = computed<ChartTableModel>(() => ({
    columns: [this.categoryHeader(), this.valueHeader(), this.shareHeader()],
    rows: this.entries().map((entry) => ({ header: entry.datum.label, cells: [entry.valueText, entry.percentText] })),
  }));

  constructor() {
    assertChartPlot(this, 'PieChartDirective');

    if (ngDevMode) {
      effect(() => {
        const invalid = this.data().filter((datum) => !Number.isFinite(datum.value) || datum.value < 0);

        if (!invalid.length) return;

        console.warn(
          new RuntimeError(
            PIE_CHART_ERROR_CODES.INVALID_VALUE,
            `[PieChartDirective] ${invalid.map((datum) => `"${datum.label}"`).join(', ')} ` +
              'has a negative or non-finite value. It draws no slice and counts as 0.',
          ).message,
        );
      });
    }
  }
}
