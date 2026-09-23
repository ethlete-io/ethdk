import { Component, inject, input, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { ChartMarkDirective } from './headless/internals/chart-mark.directive';
import { SankeyChartDirective } from './headless/sankey-chart.directive';

/**
 * A sankey chart: nodes in left-to-right columns, sized by what flows through them, joined by ribbons
 * as wide as their value. Hovering or focusing a node highlights its links. Driven by the headless
 * {@link SankeyChartDirective}.
 *
 * @example
 * <et-sankey-chart [nodes]="nodes" [links]="links" label="Club budget" />
 */
@Component({
  selector: 'et-sankey-chart',
  templateUrl: './sankey-chart.component.html',
  styleUrl: './sankey-chart.component.css',
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
      directive: SankeyChartDirective,
      inputs: [
        'nodes',
        'links',
        'label',
        'height',
        'nodeWidth',
        'nodeGap',
        'labelWidth',
        'valueFormatter',
        'incomingLabel',
        'outgoingLabel',
        'sourceHeader',
        'targetHeader',
        'valueHeader',
      ],
    },
  ],
  host: {
    class: 'et-sankey-chart',
  },
})
export class SankeyChartComponent {
  protected chart = inject(SankeyChartDirective);

  /** The color theme for nodes without their own color or a palette entry. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  protected nodeTooltips = viewChildren('nodeTooltip', { read: TemplateRef });
  protected linkTooltips = viewChildren('linkTooltip', { read: TemplateRef });

  protected hoverNode(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch') this.chart.hoverMark({ kind: 'node', key });
  }

  protected hoverLink(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch') this.chart.hoverMark({ kind: 'link', key });
  }

  protected focusNode(key: string) {
    this.chart.focusMark({ kind: 'node', key });
  }

  protected focusLink(key: string) {
    this.chart.focusMark({ kind: 'link', key });
  }
}
