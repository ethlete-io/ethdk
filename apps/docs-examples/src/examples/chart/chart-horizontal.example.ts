import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartDatum } from '@ethlete/components';

@Component({
  selector: 'app-chart-horizontal-example',
  template: `<et-bar-chart [data]="goals" [height]="200" orientation="horizontal" label="Goals scored this season" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartHorizontalExampleComponent {
  public goals: BarChartDatum[] = [
    { label: 'Falcons', value: 54 },
    { label: 'Harbour City', value: 47 },
    { label: 'Rovers', value: 41 },
    { label: 'United Athletic Club', value: 36 },
    { label: 'Wanderers', value: 29 },
  ];
}
