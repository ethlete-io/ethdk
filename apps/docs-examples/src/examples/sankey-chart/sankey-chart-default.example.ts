import { Component, ViewEncapsulation } from '@angular/core';
import { SankeyChartComponent, SankeyChartLinkInput, SankeyChartNodeInput } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-sankey-chart-default-example',
  template: `<et-sankey-chart
    [nodes]="nodes"
    [links]="links"
    [height]="320"
    label="Match-day revenue and where it goes (k€)"
  />`,
  encapsulation: ViewEncapsulation.None,
  imports: [SankeyChartComponent],
  providers: [
    provideColorPalette([
      { token: 'chart-blue', label: 'Blue' },
      { token: 'chart-orange', label: 'Orange' },
      { token: 'chart-aqua', label: 'Aqua' },
      { token: 'chart-yellow', label: 'Yellow' },
    ]),
  ],
})
export class SankeyChartDefaultExampleComponent {
  public nodes: SankeyChartNodeInput[] = [
    { id: 'tickets', label: 'Tickets' },
    { id: 'catering', label: 'Catering' },
    { id: 'merch', label: 'Merchandise' },
    { id: 'revenue', label: 'Match-day revenue' },
    { id: 'staff', label: 'Stewards and staff' },
    { id: 'security', label: 'Security' },
    { id: 'pitch', label: 'Pitch and facilities' },
    { id: 'reserves', label: 'Reserves' },
  ];

  public links: SankeyChartLinkInput[] = [
    { source: 'tickets', target: 'revenue', value: 420 },
    { source: 'catering', target: 'revenue', value: 150 },
    { source: 'merch', target: 'revenue', value: 90 },
    { source: 'revenue', target: 'staff', value: 210 },
    { source: 'revenue', target: 'security', value: 140 },
    { source: 'revenue', target: 'pitch', value: 120 },
    { source: 'revenue', target: 'reserves', value: 190 },
  ];
}
