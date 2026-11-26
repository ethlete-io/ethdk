import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The sort priority badge, as a styles-only component mounted from `TableComponent` once a table allows
 * a multi-column sort - see `TableRowBoxStylesComponent` for the same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-sort-priority-styles',
  template: '',
  styleUrl: './table-sort-priority-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableSortPriorityStylesComponent {}
