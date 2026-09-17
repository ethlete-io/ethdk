import { Component, ViewEncapsulation } from '@angular/core';
import { AxisDayComponent } from './axis-day';

@Component({
  selector: 'ethlete-design-hour-axis-a',
  template: `<ethlete-design-axis-day rule="hour" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [AxisDayComponent],
})
export default class HourAxisHourComponent {}
