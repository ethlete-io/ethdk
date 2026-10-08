import { Component, inject, input, output, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartAxisComponent } from './chart-axis.component';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartGridComponent } from './chart-grid.component';
import { ChartLegendComponent } from './chart-legend.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import {
  BarChartBar,
  BarChartDatum,
  BarChartDirective,
  BarChartSeries,
  BarChartSeriesDatum,
} from './headless/bar-chart.directive';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { ChartMarkDirective } from './headless/internals/chart-mark.directive';

/** What `(markActivate)` of an `et-bar-chart` emits: the activated bar's datum from `data` and its series. */
export type BarChartMarkActivateEvent = {
  datum: BarChartDatum | BarChartSeriesDatum;
  /** `null` in a single-series chart. */
  series: BarChartSeries | null;
};

/**
 * A bar chart with a value axis, category labels, a recessive grid and a visually hidden table view.
 * One series by default; pass `series` for grouped or stacked bars with a legend, and
 * `orientation="horizontal"` for bars that grow to the right. Driven by the headless {@link BarChartDirective}.
 * Project `etBarChartTitle` above the chart, `etBarChartNote` below it, and `etBarChartEmpty` over the plot
 * while `data` is empty. Bind `(markActivate)` to drill down from a bar.
 *
 * @example
 * <et-bar-chart [data]="signUps" label="Sign-ups per month">
 *   <h3 etBarChartTitle>Sign-ups</h3>
 *   <p etBarChartEmpty>No sign-ups yet</p>
 *   <p etBarChartNote>Source: CRM export</p>
 * </et-bar-chart>
 */
@Component({
  selector: 'et-bar-chart',
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ChartAxisComponent,
    ChartDataTableComponent,
    ChartGridComponent,
    ChartLegendComponent,
    ChartMarkDirective,
    ChartPlotDirective,
    ChartTooltipComponent,
    ProvideColorDirective,
  ],
  hostDirectives: [
    {
      directive: BarChartDirective,
      inputs: [
        'data',
        'series',
        'layout',
        'orientation',
        'label',
        'height',
        'tickCount',
        'maxBarWidth',
        'categoryLabelSpacing',
        'valueFormatter',
        'categoryHeader',
        'valueHeader',
      ],
    },
  ],
  host: {
    class: 'et-bar-chart',
  },
})
export class BarChartComponent {
  protected chart = inject(BarChartDirective);

  /** The color theme a single-series chart is drawn in, and the fallback for series without a color. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  /** Emits when a bar is clicked, or when Enter or Space is pressed on the focused bar. */
  public markActivate = output<BarChartMarkActivateEvent>();

  protected barTooltips = viewChildren('barTooltip', { read: TemplateRef });

  protected activate(event: Event, bar: BarChartBar) {
    const datum = this.chart.data()[bar.categoryIndex];

    if (!datum) return;

    event.preventDefault();
    this.markActivate.emit({ datum, series: bar.series });
  }
}
