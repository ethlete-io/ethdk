import { afterNextRender, computed, Directive, input, numberAttribute, signal } from '@angular/core';
import { injectLocale, RuntimeError } from '@ethlete/core';
import { CHART_ERROR_CODES } from '../chart-errors';
import { createBandScale, createBarPath, createLinearScale, createValueTicks } from './internals/chart-scale';
import { BarChartPlotDirective } from './bar-chart-plot.directive';

/** One bar: a category and the value its bar encodes. */
export type BarChartDatum = {
  label: string;
  value: number;
};

/** Formats a value for the axis, the tooltip and the table. */
export type BarChartValueFormatter = (value: number) => string;

/** A bar with its geometry in plot pixels, ready to render. */
export type BarChartBar = {
  datum: BarChartDatum;
  index: number;
  /** Left edge of the bar's whole category band - the hover and focus target. */
  slotX: number;
  slotWidth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The mark's outline: rounded at the data end, square at the baseline. */
  path: string;
  /** Whether the bar grows downwards from the baseline. */
  isNegative: boolean;
  valueText: string;
  /** What assistive tech reads for the bar, e.g. `"March: 1,200"`. */
  ariaLabel: string;
};

/** A value-axis tick with its vertical position in plot pixels. */
export type BarChartTick = {
  value: number;
  y: number;
  text: string;
};

const BAR_GAP = 2;
const BAR_RADIUS = 4;

/**
 * Headless single-series vertical bar chart: turns `data` into bar geometry, value-axis ticks and the
 * strings a table view needs. It measures nothing itself - the element marked `etBarChartPlot` reports
 * the width the bars are laid out in.
 *
 * @example
 * <div etBarChart [data]="data" label="Sign-ups per month">
 *   <div etBarChartPlot><svg>…</svg></div>
 * </div>
 */
@Directive({
  selector: '[etBarChart]',
  exportAs: 'etBarChart',
})
export class BarChartDirective {
  private locale = injectLocale();

  /** The bars, in the order they appear from left to right. */
  public data = input.required<readonly BarChartDatum[]>();

  /** Names the chart for assistive tech and captions its table view. */
  public label = input.required<string>();

  /** Height of the plot area in px, excluding the category labels. @default 240 */
  public height = input(240, { transform: numberAttribute });

  /** Roughly how many value-axis intervals to draw; the axis rounds to a clean 1, 2 or 5 step. @default 5 */
  public tickCount = input(5, { transform: numberAttribute });

  /** The widest a bar may get in px. Wider bands keep the rest as air. @default 24 */
  public maxBarWidth = input(24, { transform: numberAttribute });

  /** Formats values for the axis, the tooltip and the table. @default the app locale's number format */
  public valueFormatter = input<BarChartValueFormatter | null>(null);

  /** The table view's category column header. @default 'Category' */
  public categoryHeader = input('Category');

  /** The table view's value column header. @default 'Value' */
  public valueHeader = input('Value');

  /**
   * The element the bars are laid out in. Set by `etBarChartPlot`.
   *
   * @internal
   */
  public plot = signal<BarChartPlotDirective | null>(null);

  public plotWidth = computed(() => this.plot()?.width() ?? 0);

  public formatValue = computed<BarChartValueFormatter>(() => {
    const custom = this.valueFormatter();

    if (custom) return custom;

    const format = new Intl.NumberFormat(this.locale.currentLocale());

    return (value) => format.format(value);
  });

  public valueTicks = computed(() =>
    createValueTicks(
      this.data().map((datum) => datum.value),
      this.tickCount(),
    ),
  );

  private valueScale = computed(() => createLinearScale(this.valueTicks().domain, [this.height(), 0]));

  public baselineY = computed(() => this.valueScale()(0));

  public ticks = computed<BarChartTick[]>(() => {
    const scale = this.valueScale();
    const format = this.formatValue();

    return this.valueTicks().ticks.map((value) => ({ value, y: scale(value), text: format(value) }));
  });

  public bars = computed<BarChartBar[]>(() => {
    const data = this.data();
    const scale = this.valueScale();
    const format = this.formatValue();
    const baseline = this.baselineY();
    const band = createBandScale({
      count: data.length,
      width: this.plotWidth(),
      maxBandWidth: this.maxBarWidth(),
      gap: BAR_GAP,
    });

    return data.map((datum, index) => {
      const value = Number.isFinite(datum.value) ? datum.value : 0;
      const valueY = scale(value);
      const isNegative = value < 0;
      const x = band.bandStart(index);
      const y = Math.min(valueY, baseline);
      const height = Math.abs(valueY - baseline);
      const valueText = format(datum.value);

      return {
        datum,
        index,
        slotX: index * band.step,
        slotWidth: band.step,
        x,
        y,
        width: band.bandWidth,
        height,
        path: createBarPath({
          x,
          y,
          width: band.bandWidth,
          height,
          radius: BAR_RADIUS,
          roundedEnd: isNegative ? 'bottom' : 'top',
        }),
        isNegative,
        valueText,
        ariaLabel: `${datum.label}: ${valueText}`,
      };
    });
  });

  constructor() {
    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.plot()) {
          throw new RuntimeError(
            CHART_ERROR_CODES.MISSING_PLOT,
            '[BarChartDirective] A required [etBarChartPlot] element was not found in the template. ' +
              'Add the etBarChartPlot directive to the element the bars are drawn in.',
          );
        }
      });
    }
  }
}
