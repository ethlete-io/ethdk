import { Component, ViewEncapsulation } from '@angular/core';
import { HeadDayComponent } from './head-day';

@Component({
  selector: 'ethlete-design-lane-headers-b',
  template: `<ethlete-design-head-day rule="total" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [HeadDayComponent],
})
export default class LaneHeadersTotalComponent {}
