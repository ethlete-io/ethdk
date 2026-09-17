import { Component, ViewEncapsulation } from '@angular/core';
import { HeadDayComponent } from './head-day';

@Component({
  selector: 'ethlete-design-lane-headers-h',
  template: `<ethlete-design-head-day rule="ink-total" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [HeadDayComponent],
})
export default class LaneHeadersInkTotalComponent {}
