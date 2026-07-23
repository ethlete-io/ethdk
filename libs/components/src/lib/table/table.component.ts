import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, isDevMode, linkedSignal, ViewEncapsulation } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from './table-errors';
import { AnyTableColumn, TableState } from './table.types';

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
  imports: [NgTemplateOutlet],
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

  /** The rendered rows. */
  public rows = computed(() => this.data());

  /** Apply a previously captured {@link TableState} (column order + visibility). */
  public restoreState(next: TableState) {
    this.columnOrder.set(next.columns.map((column) => column.key));
    this.hiddenColumns.set(new Set(next.columns.filter((column) => column.hidden).map((column) => column.key)));
  }

  protected trackRow(row: T): string | number | T {
    return this.rowKey()?.(row) ?? row;
  }
}
