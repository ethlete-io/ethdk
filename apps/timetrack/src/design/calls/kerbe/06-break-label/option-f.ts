import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayComponent } from './break-day';

@Component({
  selector: 'ethlete-design-break-label-f',
  template: `<ethlete-design-break-day labelAt="bare" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayComponent],
})
export default class BreakLabelBareFComponent {}
