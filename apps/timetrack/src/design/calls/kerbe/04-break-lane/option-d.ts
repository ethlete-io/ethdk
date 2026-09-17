import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayShellComponent } from './day-shell';

@Component({
  selector: 'ethlete-design-break-d',
  template: `<ethlete-design-break-day mode="collapse" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayShellComponent],
})
export default class BreakOptionDComponent {}
