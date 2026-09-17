import { Component, ViewEncapsulation } from '@angular/core';
import { GutterDayComponent } from './gutter-day';

@Component({
  selector: 'ethlete-design-gutter-c',
  template: `<ethlete-design-gutter-day rule="hour-bare" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [GutterDayComponent],
})
export default class GutterHourBareComponent {}
