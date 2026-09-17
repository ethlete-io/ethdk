import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayShellComponent } from './day-shell';

@Component({
  selector: 'ethlete-design-break-a',
  template: `<ethlete-design-break-day mode="lane" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayShellComponent],
})
export default class BreakOptionAComponent {}
