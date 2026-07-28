import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The virtual window's spacer rule, as a styles-only component mounted by `etTableVirtualScroll` (see
 * `ButtonStylesDirective` for the pattern).
 *
 * Referenced only from the feature, so a table that renders every row never pulls it into the bundle —
 * the same discipline the feature's TypeScript already follows, applied to its CSS.
 *
 * @internal
 */
@Component({
  selector: 'et-table-virtual-scroll-styles',
  template: '',
  styleUrl: './table-virtual-scroll-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableVirtualScrollStylesComponent {}
