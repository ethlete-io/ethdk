import { Component, ViewEncapsulation } from '@angular/core';
import { PieChartComponent, PieChartDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-pie-chart-many-slices-example',
  template: `<et-pie-chart [data]="channels" [innerRadius]="0.6" label="Visits by channel" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [PieChartComponent],
  providers: [
    provideColorPalette([
      { token: 'chart-blue', label: 'Blue' },
      { token: 'chart-orange', label: 'Orange' },
      { token: 'chart-aqua', label: 'Aqua' },
      { token: 'chart-yellow', label: 'Yellow' },
    ]),
  ],
})
export class PieChartManySlicesExampleComponent {
  public channels: PieChartDatum[] = [
    { label: 'Search', value: 4200 },
    { label: 'Direct', value: 2600 },
    { label: 'Social', value: 1800 },
    { label: 'Referral', value: 900 },
    { label: 'Email', value: 520 },
    { label: 'Podcasts', value: 310 },
    { label: 'Print', value: 140 },
    { label: 'Events', value: 90 },
  ];
}
