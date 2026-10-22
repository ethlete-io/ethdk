import { Component, ViewEncapsulation } from '@angular/core';
import { LineChartComponent, LineChartSeries, LineChartSeriesDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-line-chart-multi-series-example',
  template: `<et-line-chart [data]="data" [series]="series" label="Tickets sold per month" />`,
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
export class LineChartMultiSeriesExampleComponent {
  public series: LineChartSeries[] = [
    { key: 'online', label: 'Online' },
    { key: 'boxOffice', label: 'Box office' },
    { key: 'partners', label: 'Partners' },
  ];

  public data: LineChartSeriesDatum[] = [
    { x: 'Jan', values: { online: 820, boxOffice: 410, partners: 160 } },
    { x: 'Feb', values: { online: 940, boxOffice: 380, partners: 210 } },
    { x: 'Mar', values: { online: 1210, boxOffice: 450, partners: 240 } },
    { x: 'Apr', values: { online: 1080, boxOffice: 520, partners: 190 } },
    { x: 'May', values: { online: 1390, boxOffice: 470, partners: 300 } },
    { x: 'Jun', values: { online: 1620, boxOffice: 560, partners: 280 } },
  ];
}
