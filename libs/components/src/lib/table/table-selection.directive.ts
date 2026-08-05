import { computed, Directive, inject, Injector, input, signal, WritableSignal } from '@angular/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableSelectAllCellComponent, TableSelectCellComponent } from './table-select-cell.component';

/** Options for {@link TableSelectionDirective}. */
export type TableSelectionConfig<T> = TableFeatureConfig & {
  /**
   * The signal holding the selected row keys (by the table's `rowKey`, else the row reference). The
   * feature writes into it directly, so pass your own signal to read the selection back - set a
   * `rowKey` on the table so a selection survives sorting, filtering and data changes.
   * Omit it and the selection is kept internally (reachable via `exportAs`).
   */
  selection?: WritableSignal<Set<unknown>>;
  /** Gate which rows can be selected. Defaults to all rows. */
  selectableRow?: (row: T) => boolean;
};

/**
 * Opt-in multi-row selection for `et-table`: adds a leading checkbox column whose header checkbox
 * selects or clears every selectable row (indeterminate while only some are).
 *
 * It carries the [checkbox](/components/choice-inputs) component with it, which is why it is separate:
 * a table without selection never pulls that in.
 *
 * @example
 * protected selected = signal<Set<unknown>>(new Set());
 *
 * <et-table
 *   [data]="rows()"
 *   [columns]="COLUMNS"
 *   [rowKey]="rowId"
 *   [etTableSelection]="{ selection: selected }"
 * />
 */
@Directive({
  selector: '[etTableSelection]',
  exportAs: 'etTableSelection',
})
export class TableSelectionDirective<T> {
  private table = injectTableFeatureHost('etTableSelection');

  /** See {@link TableSelectionConfig}. */
  public config = input({} as TableSelectionConfig<T>, {
    alias: 'etTableSelection',
    transform: tableFeatureConfig<TableSelectionConfig<T>>,
  });

  // Used when the consumer passes no signal of their own, so a bare `etTableSelection` still selects.
  private ownSelection = signal<Set<unknown>>(new Set());

  /** The signal the selection is kept in - the consumer's when they passed one, else the feature's own. */
  public selection = computed(() => this.config().selection ?? this.ownSelection);

  /** Accessible label for the header's select-all checkbox - from the table's label set. */
  public selectAllLabel = computed(() => this.table.resolvedLabels().selectAllRows);

  /** Accessible label for a row's checkbox - from the table's label set. */
  public rowLabel = computed(() => this.table.resolvedLabels().selectRow);

  /** The rendered rows that may be selected, which is what select-all acts on. */
  private selectableRows = computed(() => {
    const gate = this.config().selectableRow;

    return gate ? this.rows().filter((row) => gate(row)) : this.rows();
  });

  /** The selected rows within the current data set (keys with no matching row are ignored). */
  public selectedRows = computed(() => this.rows().filter((row) => this.isSelected(row)));

  /** True when every selectable row in the current data set is selected. */
  public isAllSelected = computed(() => {
    const rows = this.selectableRows();

    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });

  /** True when some - but not all - selectable rows are selected (checkbox indeterminate). */
  public isPartiallySelected = computed(() => {
    const rows = this.selectableRows();
    const selected = rows.filter((row) => this.isSelected(row)).length;

    return selected > 0 && selected < rows.length;
  });

  constructor() {
    this.table.registerLeadColumn({
      key: 'et-table-selection',
      width: 'var(--et-table-select-width, 44px)',
      // leftmost: before the expander (order 100) and any other feature column
      order: 0,
      cellClass: 'et-table-select-cell',
      headerComponent: TableSelectAllCellComponent,
      bodyComponent: TableSelectCellComponent,
      injector: inject(Injector),
      rowClass: (row) => (this.isSelected(row as T) ? 'et-table-row--selected' : null),
      enabled: computed(() => this.config().enabled ?? true),
    });

    // The selection is the feature's own state, so it travels in `state().features.selection` rather
    // than in the base table's column entries - see TableStateSlice. Keys serialize as strings, which
    // is what a `rowKey` produces anyway; a table without a `rowKey` keys by row reference and has
    // nothing stable to write, so it contributes nothing.
    this.table.registerStateSlice({
      key: 'selection',
      read: () => {
        const keys = [...this.selection()()];

        return keys.length ? keys.map(String) : undefined;
      },
      write: (value) => {
        if (Array.isArray(value)) this.selection().set(new Set(value.map(String)));
      },
    });
  }

  /** Whether a row is selected. */
  public isSelected(row: T) {
    return this.selection()().has(this.table.rowIdentity(row));
  }

  /** Select or deselect a single row. */
  public setSelected(row: T, selected: boolean) {
    const key = this.table.rowIdentity(row);
    const next = new Set(this.selection()());

    if (selected) {
      next.add(key);
    } else {
      next.delete(key);
    }

    this.selection().set(next);
  }

  /** Select every selectable row in the current data set, or clear them when all are already selected. */
  public toggleAll() {
    const rows = this.selectableRows();
    const next = new Set(this.selection()());
    const clearing = this.isAllSelected();

    for (const row of rows) {
      const key = this.table.rowIdentity(row);

      if (clearing) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }

    this.selection().set(next);
  }

  /** Whether a row may be selected at all (see `selectableRow`). */
  public canSelect(row: T) {
    return this.config().selectableRow?.(row) ?? true;
  }

  // The table's rows, typed back to T - the feature seam is row-type agnostic.
  private rows() {
    return this.table.rows() as readonly T[];
  }
}
