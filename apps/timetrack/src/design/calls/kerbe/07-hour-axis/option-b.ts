import { Component, ViewEncapsulation } from '@angular/core';
import { AxisDayComponent } from './axis-day';

@Component({
  selector: 'ethlete-design-hour-axis-b',
  template: `<ethlete-design-axis-day rule="gutter-ticks" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [AxisDayComponent],
})
export default class HourAxisGutterTicksComponent {}
