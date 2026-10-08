import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  output,
  TemplateRef,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { injectChartLabels } from './headless/chart-labels';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { ChartMarkDirective } from './headless/internals/chart-mark.directive';
import { PieChartDatum, PieChartDirective, PieChartSlice } from './headless/pie-chart.directive';

/**
 * A pie chart, or a donut with `innerRadius`, with a legend listing every value and share and a
 * visually hidden table view. Driven by the headless {@link PieChartDirective}. Content marked
 * `etPieChartCenter` is shown in the donut hole. Bind `(markActivate)` to drill down from a slice.
 *
 * @example
 * <et-pie-chart [data]="channels" [innerRadius]="0.6" showTotal label="Traffic by channel" />
 */
@Component({
  selector: 'et-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrl: './pie-chart.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ChartDataTableComponent,
    ChartMarkDirective,
    ChartPlotDirective,
    ChartTooltipComponent,
    ProvideColorDirective,
  ],
  hostDirectives: [
    {
      directive: PieChartDirective,
      inputs: [
        'data',
        'label',
        'size',
        'innerRadius',
        'valueFormatter',
        'categoryHeader',
        'valueHeader',
        'shareHeader',
      ],
    },
  ],
  host: {
    class: 'et-pie-chart',
  },
})
export class PieChartComponent {
  protected chart = inject(PieChartDirective);
  private labels = injectChartLabels();

  /** The accent the slices without a color of their own are drawn in steps of. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  /** Shows the formatted total in the donut hole, above `totalLabel`. Has no effect on a pie. @default false */
  public showTotal = input(false, { transform: booleanAttribute });

  /** The caption under the total in the donut hole. @default the pie total of {@link ChartLabels} */
  public totalLabel = input<string>();

  /** Emits the slice's datum when a slice is clicked, or when Enter or Space is pressed on the focused slice. */
  public markActivate = output<PieChartDatum>();

  protected sliceTooltips = viewChildren('sliceTooltip', { read: TemplateRef });

  protected resolvedTotalLabel = computed(() => this.totalLabel() ?? this.labels().pieTotal);

  protected activate(event: Event, slice: PieChartSlice) {
    event.preventDefault();
    this.markActivate.emit(slice.datum);
  }
}
