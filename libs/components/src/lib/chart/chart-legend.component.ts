import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { ChartLegendItem } from './chart.types';

@Component({
  selector: 'et-chart-legend',
  template: `
    <ul class="et-chart-legend-list">
      @for (item of items(); track item.key) {
        <li class="et-chart-legend-item">
          <span [etProvideColor]="item.colorToken" class="et-chart-legend-swatch" aria-hidden="true"></span>
          <span class="et-chart-legend-label">{{ item.label }}</span>
        </li>
      }
    </ul>
  `,
  styleUrl: './chart-legend.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    class: 'et-chart-legend',
    '[attr.data-mark]': 'mark()',
  },
})
export class ChartLegendComponent {
  public items = input.required<readonly ChartLegendItem[]>();
  public mark = input<'rect' | 'line'>('rect');
}
