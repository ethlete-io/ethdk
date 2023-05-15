import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_TOKEN, TREE_SELECT_OPTION_TOKEN, TreeSelectOptionDirective } from '../../directives';

@Component({
  selector: 'et-tree-select-option',
  template: ` <ng-content /> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-tree-select-option',
  },
  imports: [NgTemplateOutlet],
  hostDirectives: [{ directive: TreeSelectOptionDirective, inputs: ['value'] }],
})
export class TreeSelectOptionComponent {
  protected readonly treeSelectOption = inject(TREE_SELECT_OPTION_TOKEN);
  private readonly _select = inject(SELECT_TOKEN);
}
