import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The detail row's chrome and its grow-open animation, as a styles-only component mounted on demand —
 * see `ButtonStylesDirective` for the same pattern, and the table's `expandable` effect for the mount.
 *
 * Split out of `table.component.css` because it is the largest block in there (the keyframes alone are
 * most of it) and it does nothing for a table that never expands a row. Mounting it the first time a
 * table has a detail template keeps those rules out of the document — and out of style recalculation —
 * for every table that doesn't.
 *
 * @internal
 */
@Component({
  selector: 'et-table-detail-styles',
  template: '',
  styleUrl: './table-detail-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableDetailStylesComponent {}
