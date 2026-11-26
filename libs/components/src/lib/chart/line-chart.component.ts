import { Component, inject, input, output, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartAxisComponent } from './chart-axis.component';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartGridComponent } from './chart-grid.component';
import { ChartLegendComponent } from './chart-legend.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { LineChartSliceDirective } from './headless/line-chart-slice.directive';
import {
  LineChartDatum,
  LineChartDirective,
  LineChartSeries,
  LineChartSeriesDatum,
  LineChartSlice,
} from './headless/line-chart.directive';
import { LineChartTooltipComponent } from './line-chart-tooltip.component';

/** What `(markActivate)` of an `et-line-chart` emits: the activated x's datum from `data` and the series with a value there. */
export type LineChartMarkActivateEvent = {
  datum: LineChartDatum | LineChartSeriesDatum;
  /** In series order; empty in a single-series chart. */
  series: LineChartSeries[];
};

/**
 * A line chart with a value axis, a category or time axis, a recessive grid, a crosshair tooltip that
 * reads out every series at an x, and a visually hidden table view. Pass `series` for several lines,
 * `area` to fill under them and `stacked` to stack them. Bind `(markActivate)` to drill down from an x. Driven by the headless {@link LineChartDirective}.
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
        'includeZero',
        'points',
        'height',
        'tickCount',
        'valueFormatter',
        'dateFormatter',
        'timeZone',
        'xHeader',
        'categoryHeader',
        'dateHeader',
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

  /** Emits when an x is clicked, or when Enter or Space is pressed on the focused x. */
  public markActivate = output<LineChartMarkActivateEvent>();

  protected sliceTooltips = viewChildren('sliceTooltip', { read: TemplateRef });

  protected activate(event: Event, slice: LineChartSlice) {
    const data = this.chart.data();
    const datum =
      data[slice.index]?.x === slice.x ? data[slice.index] : data.find((candidate) => candidate.x === slice.x);

    if (!datum) return;

    event.preventDefault();
    this.markActivate.emit({
      datum,
      series: slice.entries.flatMap((entry) => (entry.series ? [entry.series] : [])),
    });
  }
}
