import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The row box layout, the `cards` appearance's surface/ring/corner chrome and the row-link anchor,
 * as a styles-only component mounted from `TableComponent` when either feature is on - see
 * `TableDetailStylesComponent` for the same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-row-box-styles',
  template: '',
  styleUrl: './table-row-box-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableRowBoxStylesComponent {}
