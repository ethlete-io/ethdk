import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_TOKEN, TREE_SELECT_OPTION_TOKEN, TreeSelectOptionDirective } from '../../directives';

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
  hostDirectives: [TreeSelectOptionDirective],
})
export class TreeSelectOptionComponent {
  protected readonly treeSelectOption = inject(TREE_SELECT_OPTION_TOKEN);

  private readonly _select = inject(SELECT_TOKEN);
}
