import { Component, input, ViewEncapsulation } from '@angular/core';
import { ChartTableModel } from './chart.types';

@Component({
  selector: 'et-chart-data-table',
  template: `
    <table class="et-chart-table">
      <caption>
        {{
          caption()
        }}
      </caption>
      <thead>
        <tr>
          @for (column of model().columns; track $index) {
            <th scope="col">{{ column }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of model().rows; track $index) {
          <tr>
            <th scope="row">{{ row.header }}</th>
            @for (cell of row.cells; track $index) {
              <td>{{ cell }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './chart-data-table.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-chart-data-table',
  },
})
export class ChartDataTableComponent {
  public caption = input.required<string>();
  public model = input.required<ChartTableModel>();
}
