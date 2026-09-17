import { Component, ViewEncapsulation } from '@angular/core';
import { AxisDayComponent } from './axis-day';

@Component({
  selector: 'ethlete-design-hour-axis-c',
  template: `<ethlete-design-axis-day rule="half-line" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [AxisDayComponent],
})
export default class HourAxisHalfLineComponent {}
