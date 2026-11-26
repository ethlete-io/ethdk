import { Component, ViewEncapsulation } from '@angular/core';
import { LineChartComponent, LineChartDatum } from '@ethlete/components';

@Component({
  selector: 'app-line-chart-dense-daily-example',
  template: `<et-line-chart [data]="sessions" label="Sessions per day" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [LineChartComponent],
})
export class LineChartDenseDailyExampleComponent {
  public sessions: LineChartDatum[] = Array.from({ length: 90 }, (_, day) => ({
    x: new Date(2025, 6, 1 + day),
    value: Math.round((3200 + day * 14) * (day % 7 >= 5 ? 0.7 : 1) * (0.9 + ((day * 37) % 20) / 100)),
  }));
}
