import { Component, ViewEncapsulation } from '@angular/core';
import { SankeyChartComponent } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';
import { BUDGET_LINKS, BUDGET_NODES } from './sankey-chart-multi-level.data';

@Component({
  selector: 'app-sankey-chart-multi-level-example',
  template: `
    <et-sankey-chart
      [nodes]="nodes"
      [links]="links"
      [height]="400"
      colorToken="neutral"
      label="Club budget by source, department and cost (k€)"
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
export class SankeyChartMultiLevelExampleComponent {
  public nodes = BUDGET_NODES;
  public links = BUDGET_LINKS;
}
