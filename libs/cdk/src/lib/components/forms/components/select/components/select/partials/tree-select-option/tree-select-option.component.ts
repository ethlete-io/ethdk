import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-tree-select-option',
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-tree-select-option',
  },
  imports: [],
  hostDirectives: [],
})
export class TreeSelectOptionComponent {}
