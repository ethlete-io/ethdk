import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { SELECT_TOKEN, TREE_SELECT_OPTION_TOKEN, TreeSelectOptionDirective } from '../../directives';

@Component({
  selector: 'et-tree-select-option',
  template: `
    <ng-template #optionTpl><ng-content /></ng-template>
    <ng-container *ngTemplateOutlet="optionTpl" />
  `,
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

  @ViewChild('optionTpl', { static: true })
  set optionTpl(value: TemplateRef<unknown> | null) {
    this.treeSelectOption._setOptionTemplate(value);
  }
}
