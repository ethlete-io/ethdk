import { Component, input, ViewEncapsulation } from '@angular/core';
import { TreeRow, TreeRowItemComponent } from './tree-row-item.component';

/** A stack of Studio tree rows, each a tab stop. A live tree puts `[ethlete-tree-row-item]` on its own tree nodes. */
@Component({
  selector: 'ethlete-tree-row',
  template: `
    @for (row of rows(); track $index) {
      <div
        [item]="row"
        [attr.aria-level]="row.depth + 1"
        [attr.aria-selected]="null"
        [attr.aria-expanded]="row.kind === 'leaf' ? null : row.expanded === true"
        ethlete-tree-row-item
        role="treeitem"
        tabindex="0"
      ></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TreeRowItemComponent],
  host: { class: 'flex flex-col gap-px', role: 'tree' },
})
export class TreeRowComponent {
  public rows = input<TreeRow[]>([]);
}
