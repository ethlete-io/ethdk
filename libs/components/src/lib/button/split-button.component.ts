import { Component, ViewEncapsulation } from '@angular/core';
import { SplitButtonDirective } from './headless';

@Component({
  selector: 'et-split-button',
  template: `<ng-content />`,
  styleUrl: './split-button.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [SplitButtonDirective],
  host: {
    class: 'et-split-button',
  },
})
export class SplitButtonComponent {}
