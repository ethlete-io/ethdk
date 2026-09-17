import { Component, ViewEncapsulation } from '@angular/core';
import { BreakDayShellComponent } from './day-shell';

@Component({
  selector: 'ethlete-design-break-c',
  template: `<ethlete-design-break-day mode="gutter" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [BreakDayShellComponent],
})
export default class BreakOptionCComponent {}
