import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartDatum } from '@ethlete/components';

@Component({
  selector: 'app-chart-default-example',
  template: `<et-bar-chart [data]="signUps" label="Sign-ups per month" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartDefaultExampleComponent {
  public signUps: BarChartDatum[] = [
    { label: 'Jan', value: 1240 },
    { label: 'Feb', value: 1580 },
    { label: 'Mar', value: 2130 },
    { label: 'Apr', value: 1890 },
    { label: 'May', value: 2460 },
    { label: 'Jun', value: 2980 },
    { label: 'Jul', value: 2710 },
    { label: 'Aug', value: 3320 },
  ];
}
