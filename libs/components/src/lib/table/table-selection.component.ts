import { Component, computed, input, model, TemplateRef, ViewEncapsulation, viewChild } from '@angular/core';
import { CheckboxComponent } from '../forms/checkbox';
import { injectTableFeatureHost, TableLeadCellContext } from './table-features';

/**
 * Opt-in multi-row selection for `et-table`: adds a leading checkbox column whose header checkbox
 * selects or clears every selectable row (indeterminate while only some are). Place it inside the
 * table — it renders nothing itself, it registers its column with the table.
 *
 * It carries the [checkbox](/components/choice-inputs) component with it, which is why it is separate:
 * a table without selection never pulls that in.
 *
 * @example
 * <et-table [data]="rows()" [columns]="columns" [rowKey]="rowId">
 *   <et-table-selection [(selection)]="selected" />
 * </et-table>
 */
@Component({
  selector: 'et-table-selection',
  templateUrl: './table-selection.component.html',
  styleUrl: './table-selection.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [CheckboxComponent],
})
export class TableSelectionComponent<T> {
  private table = injectTableFeatureHost('et-table-selection');

  /**
   * The selected row keys (by the table's `rowKey`, else the row reference). Two-way bindable — set a
   * `rowKey` on the table so a selection survives sorting, filtering and data changes.
   */
  public selection = model<Set<unknown>>(new Set());

  /** Gate which rows can be selected. Defaults to all rows. */
  public selectableRow = input<(row: T) => boolean>();

  /** Accessible label for the header's select-all checkbox. @default 'Select all rows' */
  public selectAllLabel = input('Select all rows');

  /** Accessible label for a row's checkbox. @default 'Select row' */
  public rowLabel = input('Select row');

  private headerCellTemplate = viewChild<TemplateRef<unknown>>('selectionHeaderCell');
  private bodyCellTemplate = viewChild<TemplateRef<TableLeadCellContext>>('selectionBodyCell');

  /** The rendered rows that may be selected, which is what select-all acts on. */
  private selectableRows = computed(() => {
    const gate = this.selectableRow();

    return gate ? this.rows().filter((row) => gate(row)) : this.rows();
  });

  /** The selected rows within the current data set (keys with no matching row are ignored). */
  public selectedRows = computed(() => this.rows().filter((row) => this.isSelected(row)));

  /** True when every selectable row in the current data set is selected. */
  public isAllSelected = computed(() => {
    const rows = this.selectableRows();

    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });

  /** True when some — but not all — selectable rows are selected (checkbox indeterminate). */
  public isPartiallySelected = computed(() => {
    const rows = this.selectableRows();
    const selected = rows.filter((row) => this.isSelected(row)).length;

    return selected > 0 && selected < rows.length;
  });

  constructor() {
    this.table.registerLeadColumn({
      key: 'et-table-selection',
      width: 'var(--et-table-select-width, 32px)',
      // leftmost: before the expander (order 100) and any other feature column
      order: 0,
      cellClass: 'et-table-select-cell',
      headerCell: this.headerCellTemplate,
      bodyCell: this.bodyCellTemplate,
      rowClass: (row) => (this.isSelected(row as T) ? 'et-table-row--selected' : null),
    });
  }

  /** Whether a row is selected. */
  public isSelected(row: T) {
    return this.selection().has(this.table.rowIdentity(row));
  }

  /** Select or deselect a single row. */
  public setSelected(row: T, selected: boolean) {
    const key = this.table.rowIdentity(row);
    const next = new Set(this.selection());

    if (selected) {
      next.add(key);
    } else {
      next.delete(key);
    }

    this.selection.set(next);
  }

  /** Select every selectable row in the current data set, or clear them when all are already selected. */
  public toggleAll() {
    const rows = this.selectableRows();
    const next = new Set(this.selection());
    const clearing = this.isAllSelected();

    for (const row of rows) {
      const key = this.table.rowIdentity(row);

      if (clearing) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }

    this.selection.set(next);
  }

  protected canSelect(row: T) {
    return this.selectableRow()?.(row) ?? true;
  }

  // The table's rows, typed back to T — the feature seam is row-type agnostic.
  private rows() {
    return this.table.rows() as readonly T[];
  }
}
