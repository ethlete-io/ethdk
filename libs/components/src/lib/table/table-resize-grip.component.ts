import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { DragHandleDirective } from '@ethlete/core';
import { TableColumnMeta } from './headless/table-features';
import { TableResizeDirective } from './table-resize.directive';

/**
 * The drag grip at one header cell's trailing edge, stamped there by `etTableResize`.
 *
 * Its own `etDragHandle` swallows the pointerdown, so grabbing the grip resizes instead of starting a
 * header reorder when both features are used together. This is where the drag primitives are actually
 * referenced; it reaches the feature by DI through the injector the feature registered with.
 *
 * @internal
 */
@Component({
  selector: 'et-table-resize-grip',
  template: `
    <span
      (dragStarted)="resize.start(column())"
      (dragMoved)="resize.update($event)"
      (dragEnded)="resize.end()"
      (dragCancelled)="resize.cancel()"
      (dblclick)="resize.reset(column())"
      class="et-table-resize-grip"
      etDragHandle
      aria-hidden="true"
    ></span>
  `,
  styleUrl: './table-resize-grip.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [DragHandleDirective],
})
export class TableResizeGripComponent {
  protected resize = inject(TableResizeDirective);

  /** The column this grip resizes. Set by the table (see {@link TableHeaderAdornment}). */
  public column = input.required<TableColumnMeta>();
}
