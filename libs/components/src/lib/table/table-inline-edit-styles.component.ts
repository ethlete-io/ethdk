import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The edit-mode cell's rules, as a styles-only component mounted by `etTableInlineEdit` (see
 * `TableVirtualScrollStylesComponent` for the pattern).
 *
 * Referenced only from the feature, so a read-only table never pulls it into the bundle.
 *
 * @internal
 */
@Component({
  selector: 'et-table-inline-edit-styles',
  template: '',
  styleUrl: './table-inline-edit-styles.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableInlineEditStylesComponent {}
