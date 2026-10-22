import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartDatum } from '@ethlete/components';

@Component({
  selector: 'app-chart-empty-example',
  template: `
    <et-bar-chart [data]="visits" label="Visits per day in April">
      <h3 etBarChartTitle>Visits per day</h3>
      <p etBarChartEmpty>No visits recorded yet</p>
      <p etBarChartNote>Source: web analytics, April</p>
    </et-bar-chart>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartEmptyExampleComponent {
  public visits: BarChartDatum[] = [];
}
