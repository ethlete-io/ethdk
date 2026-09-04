import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { CheckboxComponent } from '../forms/checkbox';
import { TableSelectionDirective } from './table-selection.directive';

/**
 * The select-all checkbox in the selection column's header cell, stamped there by
 * `etTableSelection`. Indeterminate while only some rows are selected.
 *
 * @internal
 */
@Component({
  selector: 'et-table-select-all-cell',
  template: `
    <et-checkbox
      [checked]="selection.isAllSelected()"
      [indeterminate]="selection.isPartiallySelected()"
      [aria-label]="selection.selectAllLabel()"
      (checkedChange)="selection.toggleAll()"
    />
  `,
  styleUrl: './table-select-cell.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CheckboxComponent],
})
export class TableSelectAllCellComponent {
  protected selection = inject<TableSelectionDirective<unknown>>(TableSelectionDirective);
}

/**
 * One row's selection checkbox, stamped into the selection column by `etTableSelection`. This is
 * where the checkbox component is actually referenced, so a table without selection never pulls it in.
 *
 * @internal
 */
@Component({
  selector: 'et-table-select-cell',
  template: `
    @if (selection.canSelect(row())) {
      <et-checkbox
        [checked]="selection.isSelected(row())"
        [aria-label]="selection.rowLabel()"
        (checkedChange)="selection.setSelected(row(), $event)"
      />
    }
  `,
  styleUrl: './table-select-cell.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CheckboxComponent],
})
export class TableSelectCellComponent {
  protected selection = inject<TableSelectionDirective<unknown>>(TableSelectionDirective);

  /** The row this checkbox selects. Set by the table (see {@link TableLeadCellComponent}). */
  public row = input.required<unknown>();
}
