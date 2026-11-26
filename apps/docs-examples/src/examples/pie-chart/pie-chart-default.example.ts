import { Component, ViewEncapsulation } from '@angular/core';
import { PieChartComponent, PieChartDatum } from '@ethlete/components';
import { provideColorPalette } from '@ethlete/core';

@Component({
  selector: 'app-pie-chart-default-example',
  template: `<et-pie-chart [data]="devices" label="Sessions by device" />`,
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
export class PieChartDefaultExampleComponent {
  public devices: PieChartDatum[] = [
    { label: 'Mobile', value: 5820 },
    { label: 'Desktop', value: 3410 },
    { label: 'Tablet', value: 740 },
    { label: 'Smart TV', value: 230 },
  ];
}
