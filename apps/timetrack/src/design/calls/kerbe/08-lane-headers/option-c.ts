import { Component, ViewEncapsulation } from '@angular/core';
import { HeadDayComponent } from './head-day';

@Component({
  selector: 'ethlete-design-lane-headers-c',
  template: `<ethlete-design-head-day rule="share" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [HeadDayComponent],
})
export default class LaneHeadersShareComponent {}
