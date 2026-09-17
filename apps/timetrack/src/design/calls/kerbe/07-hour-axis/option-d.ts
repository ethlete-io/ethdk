import { Component, ViewEncapsulation } from '@angular/core';
import { AxisDayComponent } from './axis-day';

@Component({
  selector: 'ethlete-design-hour-axis-d',
  template: `<ethlete-design-axis-day rule="ruler" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [AxisDayComponent],
})
export default class HourAxisRulerComponent {}
