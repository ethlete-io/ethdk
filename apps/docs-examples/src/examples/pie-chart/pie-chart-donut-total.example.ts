import { Component, ViewEncapsulation } from '@angular/core';
import { PieChartComponent, PieChartDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-pie-chart-donut-total-example',
  template: `
    <et-pie-chart [data]="devices" [innerRadius]="0.6" showTotal label="Sessions by device" />

    <et-pie-chart [data]="devices" [innerRadius]="0.6" label="Sessions by device">
      <span etPieChartCenter>Last 30 days</span>
    </et-pie-chart>
  `,
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
export class PieChartDonutTotalExampleComponent {
  public devices: PieChartDatum[] = [
    { label: 'Mobile', value: 5820 },
    { label: 'Desktop', value: 3410 },
    { label: 'Tablet', value: 740 },
    { label: 'Smart TV', value: 230 },
  ];
}
