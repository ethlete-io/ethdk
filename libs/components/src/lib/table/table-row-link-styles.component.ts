import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The row-link anchor, its focus ring and the box it stretches over, as a styles-only component
 * mounted from `TableComponent` when `[rowLink]` is bound - see `TableDetailStylesComponent` for the
 * same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-row-link-styles',
  template: '',
  styleUrl: './table-row-link-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableRowLinkStylesComponent {}
