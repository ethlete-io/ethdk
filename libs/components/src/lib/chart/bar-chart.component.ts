import { Component, inject, input, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { TooltipDirective } from '../tooltip/headless/tooltip.directive';
import { BarChartPlotDirective } from './headless/bar-chart-plot.directive';
import { BarChartDirective } from './headless/bar-chart.directive';

/**
 * A single-series vertical bar chart with a value axis, category labels, a recessive grid and a
 * visually hidden table view. Driven by the headless {@link BarChartDirective}.
 *
 * @example
 * <et-bar-chart [data]="signUps" label="Sign-ups per month" />
 */
@Component({
  selector: 'et-bar-chart',
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartPlotDirective, ProvideColorDirective, TooltipDirective],
  hostDirectives: [
    {
      directive: BarChartDirective,
      inputs: [
        'data',
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

  /** The color theme the bars are drawn in. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  protected barTooltips = viewChildren('barTooltip', { read: TemplateRef });
}
