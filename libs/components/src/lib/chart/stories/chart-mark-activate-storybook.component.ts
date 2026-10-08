import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartMarkActivateEvent } from '../bar-chart.component';
import { BarChartSeries, BarChartSeriesDatum } from '../headless/bar-chart.directive';
import { LineChartSeries, LineChartSeriesDatum } from '../headless/line-chart.directive';
import { PieChartDatum } from '../headless/pie-chart.directive';
import { SankeyChartLinkInput, SankeyChartNodeInput } from '../headless/sankey-chart.directive';
import { LineChartComponent, LineChartMarkActivateEvent } from '../line-chart.component';
import { PieChartComponent } from '../pie-chart.component';
import { SankeyChartComponent, SankeyChartMarkActivateEvent } from '../sankey-chart.component';

const TICKET_SERIES: BarChartSeries[] = [
  { key: 'online', label: 'Online' },
  { key: 'boxOffice', label: 'Box office' },
];

const TICKETS: BarChartSeriesDatum[] = [
  { label: 'Jan', values: { online: 1210, boxOffice: 450 } },
  { label: 'Feb', values: { online: 1380, boxOffice: 390 } },
  { label: 'Mar', values: { online: 1620, boxOffice: 520 } },
  { label: 'Apr', values: { online: 1490, boxOffice: 610 } },
];

const VISITOR_SERIES: LineChartSeries[] = [
  { key: 'home', label: 'Home games' },
  { key: 'away', label: 'Away games' },
];

const VISITORS: LineChartSeriesDatum[] = [
  { x: 'W1', values: { home: 12400, away: 2100 } },
  { x: 'W2', values: { home: 13100, away: 1800 } },
  { x: 'W3', values: { home: 11800, away: 2600 } },
  { x: 'W4', values: { home: 14200, away: 2300 } },
];

const CHANNELS: PieChartDatum[] = [
  { label: 'Search', value: 4120 },
  { label: 'Direct', value: 2380 },
  { label: 'Social', value: 1640 },
  { label: 'Newsletter', value: 910 },
];

const BUDGET_NODES: SankeyChartNodeInput[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'sponsors', label: 'Sponsors' },
  { id: 'budget', label: 'Budget' },
  { id: 'salaries', label: 'Salaries' },
  { id: 'travel', label: 'Travel' },
];

const BUDGET_LINKS: SankeyChartLinkInput[] = [
  { source: 'tickets', target: 'budget', value: 300 },
  { source: 'sponsors', target: 'budget', value: 1000 },
  { source: 'budget', target: 'salaries', value: 1100 },
  { source: 'budget', target: 'travel', value: 200 },
];

@Component({
  selector: 'et-sb-bar-chart-mark-activate',
  template: `
    <div [style.inline-size.px]="560" class="flex flex-col gap-4">
      <et-bar-chart
        [data]="TICKETS"
        [series]="TICKET_SERIES"
        [height]="220"
        (markActivate)="activated.set($event)"
        label="Tickets sold per month"
      />
      <p class="text-small" aria-live="polite">
        @if (activated(); as event) {
          Activated: {{ event.datum.label }} · {{ event.series?.label ?? 'no series' }}
        } @else {
          Click a bar, or focus one and press Enter or Space.
        }
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class BarChartMarkActivateStorybookComponent {
  protected readonly TICKETS = TICKETS;
  protected readonly TICKET_SERIES = TICKET_SERIES;
  protected activated = signal<BarChartMarkActivateEvent | null>(null);
}

@Component({
  selector: 'et-sb-line-chart-mark-activate',
  template: `
    <div [style.inline-size.px]="560" class="flex flex-col gap-4">
      <et-line-chart
        [data]="VISITORS"
        [series]="VISITOR_SERIES"
        [height]="220"
        (markActivate)="activated.set($event)"
        label="Visitors per week"
      />
      <p class="text-small" aria-live="polite">
        @if (activated(); as event) {
          Activated: {{ event.datum.x }} · {{ event.series.length }} series
        } @else {
          Click a week, or focus one and press Enter or Space.
        }
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [LineChartComponent],
})
export class LineChartMarkActivateStorybookComponent {
  protected readonly VISITORS = VISITORS;
  protected readonly VISITOR_SERIES = VISITOR_SERIES;
  protected activated = signal<LineChartMarkActivateEvent | null>(null);
}

@Component({
  selector: 'et-sb-pie-chart-mark-activate',
  template: `
    <div [style.inline-size.px]="480" class="flex flex-col gap-4">
      <et-pie-chart [data]="CHANNELS" (markActivate)="activated.set($event)" label="Visits by channel" />
      <p class="text-small" aria-live="polite">
        @if (activated(); as datum) {
          Activated: {{ datum.label }}
        } @else {
          Click a slice, or focus one and press Enter or Space.
        }
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PieChartComponent],
})
export class PieChartMarkActivateStorybookComponent {
  protected readonly CHANNELS = CHANNELS;
  protected activated = signal<PieChartDatum | null>(null);
}

@Component({
  selector: 'et-sb-sankey-chart-mark-activate',
  template: `
    <div [style.inline-size.px]="640" class="flex flex-col gap-4">
      <et-sankey-chart
        [nodes]="BUDGET_NODES"
        [links]="BUDGET_LINKS"
        [height]="280"
        (markActivate)="activated.set($event)"
        label="Club budget"
      />
      <p class="text-small" aria-live="polite">
        @if (activated(); as event) {
          @if (event.kind === 'node') {
            Activated node: {{ event.node.label }}
          } @else {
            Activated link: {{ event.link.source }} → {{ event.link.target }}
          }
        } @else {
          Click a node or link, or focus one and press Space.
        }
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SankeyChartComponent],
})
export class SankeyChartMarkActivateStorybookComponent {
  protected readonly BUDGET_NODES = BUDGET_NODES;
  protected readonly BUDGET_LINKS = BUDGET_LINKS;
  protected activated = signal<SankeyChartMarkActivateEvent | null>(null);
}
