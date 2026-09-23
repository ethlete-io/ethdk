import { Component, input, ViewEncapsulation } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { LineChartSliceEntry } from './headless/line-chart.directive';

@Component({
  selector: 'et-line-chart-tooltip',
  template: `
    <span class="et-line-chart-tooltip-label">{{ label() }}</span>
    @if (entries().length) {
      <ul class="et-line-chart-tooltip-list">
        @for (entry of entries(); track entry.key) {
          <li [etProvideColor]="entry.colorToken" class="et-line-chart-tooltip-row">
            <span class="et-line-chart-tooltip-key" aria-hidden="true"></span>
            @if (entry.series; as series) {
              <span class="et-line-chart-tooltip-series">{{ series.label }}</span>
            }
            <strong class="et-line-chart-tooltip-value">{{ entry.valueText }}</strong>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './line-chart-tooltip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    class: 'et-line-chart-tooltip',
  },
})
export class LineChartTooltipComponent {
  public label = input.required<string>();
  public entries = input.required<readonly LineChartSliceEntry[]>();
}
