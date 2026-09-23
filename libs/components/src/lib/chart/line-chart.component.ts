import { Component, inject, input, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartAxisComponent } from './chart-axis.component';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartGridComponent } from './chart-grid.component';
import { ChartLegendComponent } from './chart-legend.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { LineChartSliceDirective } from './headless/line-chart-slice.directive';
import { LineChartDirective } from './headless/line-chart.directive';
import { LineChartTooltipComponent } from './line-chart-tooltip.component';

/**
 * A line chart with a value axis, a category or time axis, a recessive grid, a crosshair tooltip that
 * reads out every series at an x, and a visually hidden table view. Pass `series` for several lines,
 * `area` to fill under them and `stacked` to stack them. Driven by the headless {@link LineChartDirective}.
 *
 * @example
 * <et-line-chart [data]="visitors" label="Visitors per day" />
 */
@Component({
  selector: 'et-line-chart',
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ChartAxisComponent,
    ChartDataTableComponent,
    ChartGridComponent,
    ChartLegendComponent,
    ChartPlotDirective,
    ChartTooltipComponent,
    LineChartSliceDirective,
    LineChartTooltipComponent,
    ProvideColorDirective,
  ],
  hostDirectives: [
    {
      directive: LineChartDirective,
      inputs: [
        'data',
        'series',
        'label',
        'area',
        'stacked',
        'points',
        'height',
        'tickCount',
        'valueFormatter',
        'dateFormatter',
        'timeZone',
        'xHeader',
        'valueHeader',
      ],
    },
  ],
  host: {
    class: 'et-line-chart',
  },
})
export class LineChartComponent {
  protected chart = inject(LineChartDirective);

  /** The color theme a single-series chart is drawn in, and the fallback for series without a color. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  protected sliceTooltips = viewChildren('sliceTooltip', { read: TemplateRef });
}
