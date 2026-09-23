import { Component, inject, input, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartAxisComponent } from './chart-axis.component';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartGridComponent } from './chart-grid.component';
import { ChartLegendComponent } from './chart-legend.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { BarChartDirective } from './headless/bar-chart.directive';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { ChartMarkDirective } from './headless/internals/chart-mark.directive';

/**
 * A bar chart with a value axis, category labels, a recessive grid and a visually hidden table view.
 * One series by default; pass `series` for grouped or stacked bars with a legend, and
 * `orientation="horizontal"` for bars that grow to the right. Driven by the headless {@link BarChartDirective}.
 *
 * @example
 * <et-bar-chart [data]="signUps" label="Sign-ups per month" />
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

  protected barTooltips = viewChildren('barTooltip', { read: TemplateRef });
}
