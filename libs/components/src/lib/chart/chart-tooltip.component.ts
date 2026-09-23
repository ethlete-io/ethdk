import { Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-chart-tooltip',
  template: `
    @if (series()) {
      <span class="et-chart-tooltip-key" aria-hidden="true"></span>
    }
    <strong class="et-chart-tooltip-value">{{ value() }}</strong>
    @if (series(); as seriesName) {
      <span class="et-chart-tooltip-series">{{ seriesName }}</span>
    }
    <span class="et-chart-tooltip-label">{{ label() }}</span>
  `,
  styleUrl: './chart-tooltip.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-chart-tooltip',
  },
})
export class ChartTooltipComponent {
  public value = input.required<string>();
  public label = input.required<string>();
  public series = input<string | null>(null);
}
