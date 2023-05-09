import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-select-option',
  template: `<h2>Option</h2>`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-option',
  },
  imports: [],
  hostDirectives: [],
})
export class SelectOptionComponent {}
