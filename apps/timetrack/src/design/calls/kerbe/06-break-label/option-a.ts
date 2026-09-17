import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayComponent } from './break-day';

@Component({
  selector: 'ethlete-design-break-label-a',
  template: `<ethlete-design-break-day labelAt="ground" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayComponent],
})
export default class BreakLabelGroundAComponent {}
