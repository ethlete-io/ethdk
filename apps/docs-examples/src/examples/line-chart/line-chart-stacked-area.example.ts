import { Component, ViewEncapsulation } from '@angular/core';
import { LineChartComponent, LineChartSeries, LineChartSeriesDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-line-chart-stacked-area-example',
  template: `<et-line-chart [data]="data" [series]="series" area stacked label="Streams per channel" />`,
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
export class LineChartStackedAreaExampleComponent {
  public series: LineChartSeries[] = [
    { key: 'app', label: 'App' },
    { key: 'web', label: 'Web' },
    { key: 'tv', label: 'TV' },
    { key: 'partner', label: 'Partner' },
  ];

  public data: LineChartSeriesDatum[] = Array.from({ length: 12 }, (_, month) => ({
    x: new Date(2024, 8 + month, 1),
    values: {
      app: 320 + month * 42 + (month % 3) * 30,
      web: 280 + month * 18 - (month % 4) * 20,
      tv: 140 + (month % 5) * 25,
      partner: 60 + month * 9,
    },
  }));
}
