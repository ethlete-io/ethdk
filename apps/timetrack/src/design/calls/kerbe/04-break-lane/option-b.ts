import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayShellComponent } from './day-shell';

@Component({
  selector: 'ethlete-design-break-b',
  template: `<ethlete-design-break-day mode="rule" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayShellComponent],
})
export default class BreakOptionBComponent {}
