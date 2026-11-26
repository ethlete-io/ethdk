import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The pinned-cell chrome, as a styles-only component mounted by `etTableStickyColumns` - see
 * `TableDragScrollStylesComponent` for the same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-sticky-columns-styles',
  template: '',
  styleUrl: './table-sticky-columns-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableStickyColumnsStylesComponent {}
