import { Component, ViewEncapsulation } from '@angular/core';
import { BarChartComponent, BarChartSeries, BarChartSeriesDatum } from '@ethlete/components';

@Component({
  selector: 'app-chart-grouped-example',
  template: `<et-bar-chart [data]="data" [series]="series" label="Tickets sold per month" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BarChartComponent],
})
export class ChartGroupedExampleComponent {
  public series: BarChartSeries[] = [
    { key: 'online', label: 'Online' },
    { key: 'boxOffice', label: 'Box office' },
    { key: 'partners', label: 'Partners' },
  ];

  public data: BarChartSeriesDatum[] = [
    { label: 'Jan', values: { online: 820, boxOffice: 410, partners: 160 } },
    { label: 'Feb', values: { online: 940, boxOffice: 380, partners: 210 } },
    { label: 'Mar', values: { online: 1210, boxOffice: 450, partners: 240 } },
    { label: 'Apr', values: { online: 1080, boxOffice: 520, partners: 190 } },
    { label: 'May', values: { online: 1390, boxOffice: 470, partners: 300 } },
    { label: 'Jun', values: { online: 1620, boxOffice: 560, partners: 280 } },
  ];
}
