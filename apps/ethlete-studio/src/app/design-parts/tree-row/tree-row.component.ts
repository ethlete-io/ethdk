import { Component, input, ViewEncapsulation } from '@angular/core';
import { TreeRow, TreeRowItemComponent } from './tree-row-item.component';

/** A stack of Studio tree rows, each a tab stop. A live tree puts `[ethlete-tree-row-item]` on its own tree nodes. */
@Component({
  selector: 'ethlete-tree-row',
  template: `
    @for (row of rows(); track $index) {
      <div [item]="row" ethlete-tree-row-item tabindex="0"></div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TreeRowItemComponent],
  host: { class: 'flex flex-col gap-px' },
})
export class TreeRowComponent {
  public rows = input<TreeRow[]>([]);
}
