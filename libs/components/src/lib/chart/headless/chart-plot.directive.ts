import { computed, Directive, inject, InjectionToken, WritableSignal } from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';

/** A chart directive that lays its marks out in the width an `etChartPlot` element measures. */
export type ChartPlotHost = {
  /** @internal */
  plot: WritableSignal<ChartPlotDirective | null>;
};

export const CHART_PLOT_HOST = new InjectionToken<ChartPlotHost>('CHART_PLOT_HOST');

/**
 * Marks the element a chart's marks are laid out in. Its measured width is the width the chart's
 * scales divide.
 *
 * @example
 * <div etChartPlot><svg>…</svg></div>
 */
@Directive({
  selector: '[etChartPlot]',
})
export class ChartPlotDirective {
  private dimensions = signalHostElementDimensions();

  public width = computed(() => this.dimensions().client?.width ?? 0);

  constructor() {
    const host = inject(CHART_PLOT_HOST, { optional: true });

    host?.plot.set(this);
  }
}
