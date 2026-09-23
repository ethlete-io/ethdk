import { computed, Directive, inject } from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';
import { BarChartDirective } from './bar-chart.directive';

/**
 * Marks the element the bars are laid out in. Its measured width is the width the band scale divides
 * between the categories.
 *
 * @example
 * <div etBarChartPlot><svg>…</svg></div>
 */
@Directive({
  selector: '[etBarChartPlot]',
})
export class BarChartPlotDirective {
  private dimensions = signalHostElementDimensions();

  public width = computed(() => this.dimensions().client?.width ?? 0);

  constructor() {
    const chart = inject(BarChartDirective, { optional: true });

    chart?.plot.set(this);
  }
}
