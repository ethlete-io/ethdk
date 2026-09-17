import { Component, ViewEncapsulation } from '@angular/core';
import { HeadDayComponent } from './head-day';

@Component({
  selector: 'ethlete-design-lane-headers-a',
  template: `<ethlete-design-head-day rule="name" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [HeadDayComponent],
})
export default class LaneHeadersNameComponent {}
