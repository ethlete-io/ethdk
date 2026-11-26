import { Component, inject, input, output, TemplateRef, viewChildren, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective, RegisteredColorThemeName } from '@ethlete/core';
import { ChartDataTableComponent } from './chart-data-table.component';
import { ChartTooltipComponent } from './chart-tooltip.component';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { ChartMarkDirective } from './headless/internals/chart-mark.directive';
import { SankeyChartMarkDirective } from './headless/sankey-chart-mark.directive';

/** What `(markActivate)` of an `et-sankey-chart` emits: the activated node or link, as given in `nodes` or `links`. */
export type SankeyChartMarkActivateEvent =
  { kind: 'node'; node: SankeyChartNodeInput } | { kind: 'link'; link: SankeyChartLinkInput };
import {
  SankeyChartDirective,
  SankeyChartLink,
  SankeyChartLinkInput,
  SankeyChartNode,
  SankeyChartNodeInput,
} from './headless/sankey-chart.directive';

/**
 * A sankey chart: nodes in left-to-right columns, sized by what flows through them, joined by ribbons
 * as wide as their value. Below 480px of width the flow turns top to bottom, columns becoming rows. Hovering or focusing a node highlights its links. The chart is one tab stop: the arrow keys walk
 * the nodes, Enter steps into a node's outgoing links and Escape returns. Driven by the headless
 * {@link SankeyChartDirective}. Bind `(markActivate)` to drill down from a node or link.
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
    SankeyChartMarkDirective,
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
        'linkSeparator',
        'linkKeyHint',
        'direction',
        'verticalBelow',
      ],
    },
  ],
  host: {
    class: 'et-sankey-chart',
    '[attr.data-direction]': 'chart.flowDirection()',
  },
})
export class SankeyChartComponent {
  protected chart = inject(SankeyChartDirective);

  /** The color theme for nodes without their own color or a palette entry. @default the surrounding color scope's accent */
  public colorToken = input<RegisteredColorThemeName | null>(null);

  /**
   * Emits when a node or link is clicked, or when Space is pressed on the focused one. Enter emits too,
   * except on a node with outgoing links, where it steps into them.
   */
  public markActivate = output<SankeyChartMarkActivateEvent>();
  protected nodeTooltips = viewChildren('nodeTooltip', { read: TemplateRef });

  protected linkTooltips = viewChildren('linkTooltip', { read: TemplateRef });

  protected activateNode(event: Event, node: SankeyChartNode) {
    const stepsIntoLinks =
      event instanceof KeyboardEvent &&
      event.key === 'Enter' &&
      this.chart.renderedLinks().some((link) => link.source.key === node.key);

    if (stepsIntoLinks) return;

    event.preventDefault();
    this.markActivate.emit({ kind: 'node', node: node.node });
  }

  protected activateLink(event: Event, link: SankeyChartLink) {
    event.preventDefault();
    this.markActivate.emit({ kind: 'link', link: link.link });
  }

  protected hoverNode(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch') this.chart.hoverMark({ kind: 'node', key });
  }

  protected hoverLink(event: PointerEvent, key: string) {
    if (event.pointerType !== 'touch') this.chart.hoverMark({ kind: 'link', key });
  }
}
