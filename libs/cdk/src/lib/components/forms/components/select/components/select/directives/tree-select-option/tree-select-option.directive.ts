import { Directive, InjectionToken } from '@angular/core';

export const TREE_SELECT_OPTION_TOKEN = new InjectionToken<TreeSelectOptionDirective>('ET_TREE_SELECT_OPTION_TOKEN');

let uniqueId = 0;

@Directive({
  standalone: true,
  providers: [
    {
      provide: TREE_SELECT_OPTION_TOKEN,
      useExisting: TreeSelectOptionDirective,
    },
  ],
  host: {
    '[attr.id]': 'id',
    role: 'treeitem',
  },
})
export class TreeSelectOptionDirective {
  readonly id = `et-tree-select-option-${uniqueId++}`;
}
