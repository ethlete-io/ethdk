import { TemplateRef } from '@angular/core';

/** Horizontal alignment of a column's header and cells. */
export type TableColumnAlign = 'start' | 'center' | 'end';

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

/** Per-column entry of a serialized {@link TableState}. */
export type TableColumnState = {
  key: string;
  hidden: boolean;
};

/**
 * A serializable snapshot of a table's configurable state. Versioned so persisted
 * states survive schema evolution. Phase 1 carries column order + visibility;
 * later phases add sort, filters and expanded/selected row keys.
 */
export type TableState = {
  /** State schema version. */
  v: 1;
  /** Columns in display order, each with its visibility. */
  columns: TableColumnState[];
};

/** A reference to a row, derived from a consumer-provided `rowKey`, or the row itself. */
export type TableRowKey = (row: unknown) => string | number;
