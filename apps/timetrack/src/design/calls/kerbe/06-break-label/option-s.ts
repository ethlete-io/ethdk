import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayComponent } from './break-day';

@Component({
  selector: 'ethlete-design-break-label-s',
  template: `<ethlete-design-break-day labelAt="sign-none" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayComponent],
})
export default class BreakLabelSignNoneSComponent {}
