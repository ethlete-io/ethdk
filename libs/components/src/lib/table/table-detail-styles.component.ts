import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The detail row's chrome and its grow-open animation, as a styles-only component mounted by
 * `etTableRowExpansion` - see `ButtonStylesDirective` for the same pattern.
 *
 * Split out of `table.component.css` because it is the largest block in there (the keyframes alone are
 * most of it) and it does nothing for a table that never expands a row. It arrives with the feature, so
 * those rules stay out of the document - and out of style recalculation - for every table without it.
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
