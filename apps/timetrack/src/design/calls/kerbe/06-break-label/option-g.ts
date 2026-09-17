import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayComponent } from './break-day';

@Component({
  selector: 'ethlete-design-break-label-g',
  template: `<ethlete-design-break-day labelAt="hatch-notch" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayComponent],
})
export default class BreakLabelHatchNotchGComponent {}
