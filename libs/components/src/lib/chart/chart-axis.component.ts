import { Component, input, ViewEncapsulation } from '@angular/core';
import { ChartAxisLabel } from './chart.types';

@Component({
  selector: 'et-chart-axis',
  template: `
    @for (label of labels(); track label.key) {
      <span
        [style.--_et-chart-axis-position.px]="label.position"
        [style.--_et-chart-axis-extent.px]="label.extent ?? null"
        [attr.data-extent]="label.extent === undefined ? null : ''"
        class="et-chart-axis-label"
        >{{ label.text }}</span
      >
    }
  `,
  styleUrl: './chart-axis.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-chart-axis',
    'aria-hidden': 'true',
    '[attr.data-orientation]': 'orientation()',
  },
})
export class ChartAxisComponent {
  public labels = input.required<readonly ChartAxisLabel[]>();
  public orientation = input<'horizontal' | 'vertical'>('horizontal');
}
