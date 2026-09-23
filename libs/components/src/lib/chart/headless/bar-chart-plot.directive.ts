import { Directive } from '@angular/core';
import { ChartPlotDirective } from './chart-plot.directive';

/**
 * The bar chart's name for {@link ChartPlotDirective}: marks the element the bars are laid out in.
 *
 * @example
 * <div etBarChartPlot><svg>…</svg></div>
 */
@Directive({
  selector: '[etBarChartPlot]',
})
export class BarChartPlotDirective extends ChartPlotDirective {}
