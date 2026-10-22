import { Component, ViewEncapsulation } from '@angular/core';
import { LineChartComponent, LineChartSeries, LineChartSeriesDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-line-chart-gaps-example',
  template: `<et-line-chart [data]="data" [series]="series" points label="Match attendance (k)" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [LineChartComponent],
  providers: [
    provideColorPalette([
      { token: 'chart-blue', label: 'Blue' },
      { token: 'chart-orange', label: 'Orange' },
      { token: 'chart-aqua', label: 'Aqua' },
      { token: 'chart-yellow', label: 'Yellow' },
    ]),
  ],
})
export class LineChartGapsExampleComponent {
  public series: LineChartSeries[] = [
    { key: 'home', label: 'Home' },
    { key: 'away', label: 'Away' },
  ];

  public data: LineChartSeriesDatum[] = [
    { x: 'W1', values: { home: 18.2, away: 4.1 } },
    { x: 'W2', values: { home: 19.4, away: 3.8 } },
    { x: 'W3', values: { home: null, away: 4.6 } },
    { x: 'W4', values: { home: 21.0, away: null } },
    { x: 'W5', values: { home: 20.3, away: 5.2 } },
    { x: 'W6', values: { home: 22.8, away: null } },
    { x: 'W7', values: { home: 23.1, away: 5.9 } },
    { x: 'W8', values: { home: null, away: 6.3 } },
    { x: 'W9', values: { home: 24.6, away: 6.0 } },
  ];
}
