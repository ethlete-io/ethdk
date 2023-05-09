import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-select-body',
  template: ` <h1>body</h1> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-body',
  },
  imports: [],
  hostDirectives: [],
})
export class SelectBodyComponent {}
