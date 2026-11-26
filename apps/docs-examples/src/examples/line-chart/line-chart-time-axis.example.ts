import { Component, ViewEncapsulation } from '@angular/core';
import { LineChartComponent, LineChartDatum } from '@ethlete/components';

const DAILY_VISITORS = [
  412, 438, 401, 520, 610, 655, 480, 455, 470, 498, 560, 702, 744, 530, 512, 546, 590, 640, 810, 862, 600, 575, 590,
  615, 680, 900, 948, 690,
];

@Component({
  selector: 'app-line-chart-time-axis-example',
  template: `<et-line-chart [data]="visitors" label="Visitors per day" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [LineChartComponent],
})
export class LineChartTimeAxisExampleComponent {
  public visitors: LineChartDatum[] = DAILY_VISITORS.map((value, index) => ({
    x: new Date(2025, 2, 17 + index),
    value,
  }));
}
