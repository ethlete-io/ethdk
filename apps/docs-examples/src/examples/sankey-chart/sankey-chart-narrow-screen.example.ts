import { Component, ViewEncapsulation } from '@angular/core';
import { SankeyChartComponent } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';
import { BUDGET_LINKS, BUDGET_NODES } from './sankey-chart-narrow-screen.data';

@Component({
  selector: 'app-sankey-chart-narrow-screen-example',
  template: `
    <div [style.inline-size.px]="360">
      <et-sankey-chart
        [nodes]="nodes"
        [links]="links"
        [height]="480"
        label="Club budget by source, department and cost (k€)"
      />
    </div>
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
export class SankeyChartNarrowScreenExampleComponent {
  public nodes = BUDGET_NODES;
  public links = BUDGET_LINKS;
}
