import { Signal, TemplateRef } from '@angular/core';

/** Horizontal alignment of a column's header and cells. */
export type TableColumnAlign = 'start' | 'center' | 'end';

/** A comparable value a column can be sorted by. */
export type TableSortValue = string | number | Date | boolean | null | undefined;

export type TableSortDirection = 'asc' | 'desc';

/** One column's sort, by column `key`. Sort state is an ordered list of these. */
export type TableSort = {
  key: string;
  direction: TableSortDirection;
};

/** A selectable value in a column's filter menu. */
export type TableFilterOption = {
  label: string;
  value: unknown;
};

/**
 * An async/dynamic source for a column's filter options — the shape
 * `selectOptionsFromQuery` produces, so it can be reused directly (map its
 * options to `TableFilterOption`s). Wired to the filter menu's search + load-more.
 */
export type TableFilterOptionsProvider = {
  options: Signal<TableFilterOption[]>;
  loading?: Signal<boolean>;
  hasMore?: Signal<boolean>;
  setQuery?: (query: string) => void;
  loadMore?: () => void;
};

/** One column's active filter — the selected values, by column `key`. */
export type TableFilter = {
  key: string;
  values: unknown[];
};

/** The context passed to a custom cell template. */
export type TableCellContext<T, TValue> = {
  /** The row. */
  $implicit: T;
  /** The accessor's value for this cell. */
  value: TValue;
  /** The zero-based row index within the currently rendered rows. */
  index: number;
};

/** The context passed to a custom header template. */
export type TableHeaderContext = {
  /** The column's static header text, if any. */
  $implicit: string | undefined;
};

/** The context passed to the expanded-row detail template. */
export type TableExpandedRowContext<T> = {
  /** The row being expanded. */
  $implicit: T;
};

/**
 * A typed column definition. Authored via {@link tableColumns} so the row type `T`
 * flows into every `value` accessor, and via `key` into sort/filter/state — the
 * key never wires templates to data.
 */
export type TableColumn<T, TValue = unknown> = {
  /** Stable identity, used for state serialization (order, visibility, sort, filter). */
  key: string;

  /** Static header text. Ignored when `headerCell` is set. */
  header?: string;

  /** Typed accessor for the cell's value. Rendered directly unless `cell` is set. */
  value: (row: T) => TValue;

  /** Allow sorting by this column (renders a sortable header). @default false */
  sortable?: boolean;

  /** Comparable value to sort by. Defaults to `value`. Use when the display value isn't comparable. */
  sortValue?: (row: T) => TableSortValue;

  /** Show a filter menu on this column's header. Provide `filterOptions` for the choices. */
  filterable?: boolean;

  /** The selectable values shown in the filter menu — a static list or an async {@link TableFilterOptionsProvider}. */
  filterOptions?: TableFilterOption[] | TableFilterOptionsProvider;

  /** Show a search box in the filter menu (client-side for a static list; drives `setQuery` for a provider). */
  filterSearch?: boolean;

  /** The value matched against the selected filter values. Defaults to `value`. */
  filterValue?: (row: T) => unknown;

  /** Custom cell template. Receives {@link TableCellContext}. */
  cell?: TemplateRef<TableCellContext<T, TValue>>;

  /** Custom header template. Receives {@link TableHeaderContext}. */
  headerCell?: TemplateRef<TableHeaderContext>;

  /** Header/cell alignment. @default 'start' */
  align?: TableColumnAlign;

  /**
   * The grid track size for this column (any `grid-template-columns` track value,
   * e.g. `'1fr'`, `'200px'`, `'minmax(120px, 1fr)'`).
   * @default 'minmax(0, 1fr)'
   */
  width?: string;

  /** Hide the column initially. Toggle later via table state. @default false */
  hidden?: boolean;
};

/** Any column definition, regardless of value type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTableColumn<T> = TableColumn<T, any>;

/**
 * Per-column entry of a serialized {@link TableState}. Shaped to map 1:1 onto
 * server-side per-column config (e.g. a list-view's `hidden` / `valueSortOrder` /
 * `filterValues`), so bridging to a backend is mechanical.
 */
export type TableColumnState = {
  key: string;
  hidden: boolean;
  /** This column's sort direction, when it is sorted. Omitted when unsorted. */
  sort?: TableSortDirection;
  /**
   * This column's 0-based position within the active multi-sort, so the sort priority
   * round-trips. Written only when more than one column is sorted.
   */
  sortPriority?: number;
  /** This column's selected filter values. Omitted when the column is unfiltered. */
  filterValues?: unknown[];
};

/**
 * A serializable snapshot of a table's configurable state — column order, visibility,
 * sort and filters (per column) plus expanded rows. Versioned so persisted states
 * survive schema evolution. Round-trips via `state()` / `restoreState()`.
 */
export type TableState = {
  /** State schema version. */
  v: 1;
  /** Columns in display order, each with its visibility, sort and filter. */
  columns: TableColumnState[];
  /**
   * Expanded row keys (the string form of each `rowKey`). Present only when row
   * expansion is used with a `rowKey` — without one, expansion can't be serialized.
   */
  expanded?: string[];
};

/** A reference to a row, derived from a consumer-provided `rowKey`, or the row itself. */
export type TableRowKey = (row: unknown) => string | number;
