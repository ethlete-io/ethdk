import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The grab cursors a dragged table scrolls under, as a styles-only component mounted by
 * `etTableDragScroll` - see `TableDetailStylesComponent` for the same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-drag-scroll-styles',
  template: '',
  styleUrl: './table-drag-scroll-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableDragScrollStylesComponent {}
