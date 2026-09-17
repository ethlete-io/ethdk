import { Component, ViewEncapsulation } from '@angular/core';
import { GutterDayComponent } from './gutter-day';

@Component({
  selector: 'ethlete-design-gutter-b',
  template: `<ethlete-design-gutter-day rule="hour-padded" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [GutterDayComponent],
})
export default class GutterHourPaddedComponent {}
