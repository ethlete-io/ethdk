import { Component, ViewEncapsulation } from '@angular/core';
import { SankeyChartComponent } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';
import { TRAFFIC_LINKS, TRAFFIC_NODES } from './sankey-chart-many-nodes.data';

@Component({
  selector: 'app-sankey-chart-many-nodes-example',
  template: `
    <et-sankey-chart
      [nodes]="nodes"
      [links]="links"
      [height]="480"
      label="Website visits by channel, page and outcome"
    />
  `,
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
export class SankeyChartManyNodesExampleComponent {
  public nodes = TRAFFIC_NODES;
  public links = TRAFFIC_LINKS;
}
