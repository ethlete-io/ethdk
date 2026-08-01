import { Component, inject, ViewEncapsulation } from '@angular/core';
import { TableReorderDirective } from './table-reorder.directive';

/**
 * The reorder drag ghost, stamped into the table as a layer by `etTableReorder` (see `registerLayer`).
 * Renders nothing until a drag starts.
 *
 * This is what lets the reorder feature be a directive: the drag lives on the header cells the table
 * renders, and the only thing that needs a view - this floating UI - is hosted by the table. Where the
 * column will land needs no view at all: the columns themselves slide into the landing order.
 *
 * @internal
 */
@Component({
  selector: 'et-table-reorder-overlay',
  template: `
    @if (reorder.dragging(); as drag) {
      <!-- Floating copy of the dragged header; the table's own markup stays put until drop. -->
      @if (reorder.pointer(); as position) {
        <div [style.left.px]="position.x" [style.top.px]="position.y" class="et-table-drag-ghost" aria-hidden="true">
          {{ drag.header }}
        </div>
      }
    }
  `,
  styleUrl: './table-reorder-overlay.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableReorderOverlayComponent {
  protected reorder = inject(TableReorderDirective);
}
