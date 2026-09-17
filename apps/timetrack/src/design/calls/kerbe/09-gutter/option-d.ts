import { Component, ViewEncapsulation } from '@angular/core';
import { GutterDayComponent } from './gutter-day';

@Component({
  selector: 'ethlete-design-gutter-d',
  template: `<ethlete-design-gutter-day rule="roomy" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [GutterDayComponent],
})
export default class GutterRoomyComponent {}
