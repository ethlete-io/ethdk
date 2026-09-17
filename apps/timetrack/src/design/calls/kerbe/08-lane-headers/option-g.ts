import { Component, ViewEncapsulation } from '@angular/core';
import { HeadDayComponent } from './head-day';

@Component({
  selector: 'ethlete-design-lane-headers-g',
  template: `<ethlete-design-head-day rule="total-under" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [HeadDayComponent],
})
export default class LaneHeadersTotalUnderComponent {}
