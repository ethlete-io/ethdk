import { Component, ViewEncapsulation } from '@angular/core';
import { GutterDayComponent } from './gutter-day';

@Component({
  selector: 'ethlete-design-gutter-a',
  template: `<ethlete-design-gutter-day rule="today" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [GutterDayComponent],
})
export default class GutterTodayComponent {}
