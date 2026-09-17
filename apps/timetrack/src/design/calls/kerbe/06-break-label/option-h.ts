import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayComponent } from './break-day';

@Component({
  selector: 'ethlete-design-break-label-h',
  template: `<ethlete-design-break-day labelAt="hatch-rules" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayComponent],
})
export default class BreakLabelHatchRulesHComponent {}
