import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartDatum } from '@ethlete/components';

const DAILY_VISITS = [
  412, 388, 455, 501, 476, 298, 264, 430, 467, 489, 512, 530, 310, 287, 445, 472, 498, 521, 544, 330, 301, 468, 490,
  515, 538, 560, 345, 318, 480, 505, 527,
];

@Component({
  selector: 'app-chart-dense-labels-example',
  template: `
    <et-bar-chart [data]="visits" label="Visits per day in March">
      <h3 etBarChartTitle>Visits per day</h3>
      <p etBarChartNote>Source: web analytics, March</p>
    </et-bar-chart>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartDenseLabelsExampleComponent {
  public visits: BarChartDatum[] = DAILY_VISITS.map((value, index) => ({ label: 'Mar ' + (index + 1), value }));
}
