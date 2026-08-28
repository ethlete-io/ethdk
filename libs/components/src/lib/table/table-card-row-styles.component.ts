import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The `cards` appearance's row box, surface, ring and corner chrome, as a styles-only component
 * mounted from `TableComponent` when `[appearance]="'cards'"` - see `TableDetailStylesComponent` for
 * the same pattern.
 *
 * @internal
 */
@Component({
  selector: 'et-table-card-row-styles',
  template: '',
  styleUrl: './table-card-row-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableCardRowStylesComponent {}
