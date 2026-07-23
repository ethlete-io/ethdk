import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, isDevMode, linkedSignal, model, ViewEncapsulation } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import {
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../menu';
import { filterRows } from './table-filter';
import { sortRows } from './table-sort';
import { TABLE_ERROR_CODES } from './table-errors';
import { AnyTableColumn, TableFilter, TableSort, TableSortDirection, TableState } from './table.types';

const DEFAULT_TRACK = 'minmax(0, 1fr)';

/**
 * The default table. Renders typed rows and cells from a {@link tableColumns}
 * definition on a CSS grid with a sticky header and an empty state. Light by
 * default — sort, filter, expansion, reordering, virtualization and state
 * persistence arrive as separate opt-in features.
 *
 * @example
 * const columns = tableColumns<User>([
 *   { key: 'name', header: 'Name', value: (u) => u.name },
 *   { key: 'email', header: 'Email', value: (u) => u.email },
 * ]);
 *
 * <et-table [data]="users()" [columns]="columns" />
 */
@Component({
  selector: 'et-table',
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuCheckboxGroupComponent,
    MenuCheckboxItemComponent,
  ],
  host: {
    class: 'et-table-host',
  },
})
export class TableComponent<T> {
  /** The rows to render. */
  public data = input<readonly T[]>([]);

  /** The typed column definitions (see {@link tableColumns}). */
  public columns = input<AnyTableColumn<T>[]>([]);

  /**
   * Stable per-row identity for change tracking (and, later, row-keyed state such
   * as selection/expansion). Defaults to row reference identity.
   */
  public rowKey = input<(row: T) => string | number>();

  /** Text shown when there are no rows and no `[etTableEmpty]` content is projected. */
  public emptyLabel = input('No data');

  /**
   * The active sort, as an ordered list of `{ key, direction }`. Two-way bindable.
   * In `'client'` mode the table sorts rows by it; in `'server'` mode it's yours to
   * feed into query args.
   */
  public sort = model<TableSort[]>([]);

  /** Allow more than one column to be sorted at once. @default false */
  public multiSort = input(false);

  /**
   * `'client'` sorts the rows in the browser via {@link sortRows}; `'server'`
   * leaves rows untouched so the backend can sort.
   * @default 'client'
   */
  public sortMode = input<'client' | 'server'>('client');

  /**
   * The active filters, as `{ key, values }` per filtered column. Two-way bindable.
   * In `'client'` mode the table filters rows by it; in `'server'` mode it's yours
   * to feed into query args.
   */
  public filters = model<TableFilter[]>([]);

  /**
   * `'client'` filters the rows in the browser via {@link filterRows}; `'server'`
   * leaves rows untouched so the backend can filter.
   * @default 'client'
   */
  public filterMode = input<'client' | 'server'>('client');

  // Column order + visibility overrides reset when the `columns` input changes, but
  // a manual restoreState() persists until then (linkedSignal semantics).
  private columnOrder = linkedSignal(() => this.columns().map((column) => column.key));
  private hiddenColumns = linkedSignal(
    () =>
      new Set(
        this.columns()
          .filter((column) => column.hidden)
          .map((column) => column.key),
      ),
  );

  private columnsByKey = computed(() => {
    const map = new Map<string, AnyTableColumn<T>>();

    for (const column of this.columns()) {
      if (isDevMode() && map.has(column.key)) {
        throw new RuntimeError(
          TABLE_ERROR_CODES.DUPLICATE_COLUMN_KEY,
          `[etTable] Duplicate column key "${column.key}". Column keys must be unique.`,
        );
      }

      map.set(column.key, column);
    }

    return map;
  });

  private orderedColumns = computed(() => {
    const map = this.columnsByKey();

    return this.columnOrder()
      .map((key) => map.get(key))
      .filter((column): column is AnyTableColumn<T> => column !== undefined);
  });

  /** Columns currently displayed, in order. */
  public visibleColumns = computed(() =>
    this.orderedColumns().filter((column) => !this.hiddenColumns().has(column.key)),
  );

  /** The `grid-template-columns` value for the visible columns. */
  public templateColumns = computed(() =>
    this.visibleColumns()
      .map((column) => column.width ?? DEFAULT_TRACK)
      .join(' '),
  );

  /** The serializable, versioned table state (column order + visibility). */
  public state = computed<TableState>(() => ({
    v: 1,
    columns: this.orderedColumns().map((column) => ({
      key: column.key,
      hidden: this.hiddenColumns().has(column.key),
    })),
  }));

  /**
   * The rendered rows — client-filtered then client-sorted for whichever of
   * `filterMode`/`sortMode` is `'client'`.
   */
  public rows = computed(() => {
    const columns = this.columns();
    let result: readonly T[] = this.data();

    if (this.filterMode() !== 'server') {
      result = filterRows({ rows: result, filters: this.filters(), columns });
    }

    if (this.sortMode() !== 'server') {
      result = sortRows({ rows: result, sort: this.sort(), columns });
    }

    return [...result];
  });

  /** Apply a previously captured {@link TableState} (column order + visibility). */
  public restoreState(next: TableState) {
    this.columnOrder.set(next.columns.map((column) => column.key));
    this.hiddenColumns.set(new Set(next.columns.filter((column) => column.hidden).map((column) => column.key)));
  }

  /** The sort direction for a column key, or `null` when it isn't sorted. */
  public sortDirection(key: string): TableSortDirection | null {
    return this.sort().find((entry) => entry.key === key)?.direction ?? null;
  }

  /**
   * Cycle a column's sort: unsorted → ascending → descending → unsorted. In
   * single-sort mode this replaces any other sort; with `multiSort` it toggles
   * this column while keeping the others (appended in click order).
   */
  public toggleSort(key: string) {
    const current = this.sort();
    const direction = this.sortDirection(key);
    const others = this.multiSort() ? current.filter((entry) => entry.key !== key) : [];

    if (direction === null) {
      this.sort.set([...others, { key, direction: 'asc' }]);
    } else if (direction === 'asc') {
      this.sort.set([...others, { key, direction: 'desc' }]);
    } else {
      this.sort.set(others);
    }
  }

  /** The selected filter values for a column key (empty when unfiltered). */
  public filterValuesFor(key: string): unknown[] {
    return this.filters().find((entry) => entry.key === key)?.values ?? [];
  }

  /** Replace a column's selected filter values (drops the entry when empty). */
  public setFilterValues(key: string, values: unknown[]) {
    const others = this.filters().filter((entry) => entry.key !== key);

    this.filters.set(values.length ? [...others, { key, values }] : others);
  }

  protected trackRow(row: T): string | number | T {
    return this.rowKey()?.(row) ?? row;
  }

  protected isFiltered(key: string) {
    return this.filterValuesFor(key).length > 0;
  }

  protected asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const direction = this.sortDirection(key);

    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
  }
}
