import { Signal, TemplateRef } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';

/** Horizontal alignment of a column's header and cells. */
export type TableColumnAlign = 'start' | 'center' | 'end';

/**
 * What a column may hand back for export. Anything else needs an `exportValue` — a CSV field is
 * text, and `String(anObject)` is not an answer anyone wants in a spreadsheet.
 */
export type TableCsvValue = string | number | boolean | Date | null | undefined;

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

/** Which of a column's slots a registered template fills. */
export type TableTemplateSlot = 'cell' | 'header' | 'footer' | 'filterOption' | 'cellSkeleton' | 'cellEdit';

/**
 * How many of a column's filter options can be picked at once: `'multiple'` (the default) is a
 * checkbox menu, `'single'` a radio menu that holds at most one value. Filter state is a list of
 * values either way, so nothing downstream — client filtering, `state()`, a server request — has to
 * care which one a column uses.
 */
export type TableFilterSelection = 'single' | 'multiple';

/**
 * A single cell's own async state, independent of the table's: `'loading'` replaces the cell's
 * content with a placeholder bar, `'error'` keeps the content and marks it in the app's error color.
 * For inline editing, where one cell saves (or fails) on its own — see `cellState`.
 */
export type TableCellState = 'loading' | 'error';

/**
 * What a `cellState` callback may return: the bare state, or the state plus what went wrong. A
 * `message` is shown on the error mark — as its `title` and accessible name in the base table, and as
 * a real tooltip once `etTableCellErrorTooltip` is imported.
 */
export type TableCellStateValue = TableCellState | { state: TableCellState; message?: string | null };

/**
 * A template registered for one column by `etTableCell` and friends. The column is matched by
 * **identity** against the table's `columns` record, which is what lets a template be bound to the
 * column object itself (`[etTableCell]="COLUMNS.role"`) and have its context typed from it.
 */
export type TableColumnTemplate = {
  slot: TableTemplateSlot;
  /** The bound column definition. Read as a signal so a rebuilt `columns` record stays matched. */
  column: Signal<object>;
  template: TemplateRef<unknown>;
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

/**
 * The context passed to a column's edit template (`etTableCellEdit`) while that cell is being edited.
 *
 * `field` is the draft the feature holds for this one edit — a signal-forms field, so the control is
 * bound the way every control in this library is bound (`[formField]`), with no cell-editor abstraction
 * in between. It starts at the cell's current value; committing hands whatever it holds to `commit`.
 */
export type TableCellEditContext<T, TValue> = {
  /** The row being edited. */
  $implicit: T;
  /** The draft field to bind the editor to with `[formField]`. */
  field: FieldTree<TValue>;
  /** The cell's value as it was when the edit started — what Escape restores. */
  value: TValue;
};

/** The context passed to a filter option template — the option being rendered. */
export type TableFilterOptionContext = {
  /** The option: its `label` and `value`, plus whatever else you put on it. */
  $implicit: TableFilterOption;
  /** Whether this option is currently among the column's selected filter values. */
  selected: boolean;
};

/**
 * The context passed to a column's loading-placeholder template. The index and width are what the
 * table would have used for its own bone, so a custom one can stay in the same rhythm.
 */
export type TableCellSkeletonContext = {
  /** The placeholder row's index (0-based) — for varying the shape down the column. */
  $implicit: number;
  /** The width (%) the table's default bone would have used at this position. */
  width: number;
};

/** The context passed to a custom header template. */
export type TableHeaderContext = {
  /** The column's static header text, if any. */
  $implicit: string | undefined;
};

/** The context passed to the empty-state template — the (empty) row list. */
export type TableEmptyContext<T> = {
  /** The rows the table would render: empty here, but typed, so one template can serve both cases. */
  $implicit: readonly T[];
};

/** The context passed to the error-state template — whatever was bound to the table's `error`. */
export type TableErrorContext = {
  /** The error value, as given. */
  $implicit: unknown;
};

/** The context passed to the expanded-row detail template. */
export type TableExpandedRowContext<T> = {
  /** The row being expanded. */
  $implicit: T;
};

/** The context passed to a column's footer cell template — all currently rendered rows, for aggregates. */
export type TableFooterContext<T> = {
  /** The rendered rows (client-filtered/sorted), e.g. to sum a column. */
  $implicit: readonly T[];
};

/**
 * A typed column definition. Declare a table's columns as a {@link TableColumns} record
 * (`satisfies TableColumns<Row>`) so the row type flows into every `value` accessor and each
 * column's key is the key it is declared under — nothing to repeat or keep in sync.
 */
export type TableColumn<T, TValue = unknown> = {
  /** Static header text. Ignored when a header-cell template is registered for this column. */
  header?: string;

  /** Typed accessor for the cell's value. Rendered directly unless an `etTableCell` template is registered. */
  value: (row: T) => TValue;

  /** Allow sorting by this column (renders a sortable header). @default false */
  sortable?: boolean;

  /** Comparable value to sort by. Defaults to `value`. Use when the display value isn't comparable. */
  sortValue?: (row: T) => TableSortValue;

  /**
   * The value a CSV export writes for this column. Defaults to `value`. Required for a column whose
   * cell is an `etTableCell` template — a template renders DOM, which has no text form to export —
   * and for one whose `value` isn't a primitive.
   */
  exportValue?: (row: T) => TableCsvValue;

  /**
   * Let this column's cells be edited in place. Needs `etTableInlineEdit` on the table and an
   * `etTableCellEdit` template for the column — the template is the editor, so a column marked
   * `editable` without one stays read-only.
   */
  editable?: boolean;

  /** Show a filter menu on this column's header. Provide `filterOptions` for the choices. */
  filterable?: boolean;

  /** The selectable values shown in the filter menu — a static list or an async {@link TableFilterOptionsProvider}. */
  filterOptions?: TableFilterOption[] | TableFilterOptionsProvider;

  /** Show a search box in the filter menu (client-side for a static list; drives `setQuery` for a provider). */
  filterSearch?: boolean;

  /**
   * Whether the filter menu picks one value or several. `'single'` renders radio items and replaces the
   * selection on each pick (choosing the selected one again clears it); `'multiple'` renders checkboxes.
   * @default 'multiple'
   */
  filterSelection?: TableFilterSelection;

  /** The value matched against the selected filter values. Defaults to `value`. */
  filterValue?: (row: T) => unknown;

  /**
   * Pin this column to the inline-start or inline-end edge while the table scrolls horizontally.
   * Pin from the edges — leading columns to `'start'`, trailing columns to `'end'`.
   */
  sticky?: 'start' | 'end';

  /** Header/cell alignment. @default 'start' */
  align?: TableColumnAlign;

  /**
   * The grid track size for this column (any `grid-template-columns` track value,
   * e.g. `'1fr'`, `'200px'`, `'minmax(120px, 1fr)'`).
   * @default `minmax(<minWidth>px, 1fr)`
   */
  width?: string;

  /**
   * Narrowest this column may get (px), whether it is dragged there or squeezed there by a wider
   * neighbour. Lower it for a column that genuinely reads at a glance — a two-character status, an
   * icon — where the default would waste space. Ignored when `width` is a fixed length, which is
   * already the column saying exactly how wide it is.
   * @default 96
   */
  minWidth?: number;

  /** Hide the column initially. Toggle later via table state. @default false */
  hidden?: boolean;

  /**
   * Group this column under a spanning header label. Adjacent visible columns sharing the same
   * `group` render beneath one label in a second header row; each stays independently sortable/
   * filterable. Columns without a `group` span both header rows.
   */
  group?: string;
};

/** Any column definition, regardless of value type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTableColumn<T> = TableColumn<T, any>;

/**
 * A table's column definitions, keyed by column key — the key each column is declared under is
 * the one used for sorting, filtering, cell templates and serialized state.
 *
 * @example
 * const COLUMNS = {
 *   name: { header: 'Name', value: (user: User) => user.name, sortable: true },
 *   email: { header: 'Email', value: (user: User) => user.email },
 * } satisfies TableColumns<User>;
 */
export type TableColumns<T> = Record<string, AnyTableColumn<T>>;

/**
 * A column definition paired with the key it was declared under. This is what the table renders
 * from and what features see — consumers author {@link TableColumns} instead.
 */
export type TableColumnDef<T> = AnyTableColumn<T> & { key: string };

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
  /** This column's user-resized width in pixels. Omitted when the column is at its default width. */
  width?: number;
};

/**
 * A serializable snapshot of a table's configurable state — column order, visibility,
 * sort and filters (per column) plus expanded rows. Versioned so persisted states
 * survive schema evolution. Round-trips via `state()` / `restoreState()`.
 */
export type TableState = {
  /** State schema version. `1` predates the `features` bag and still restores. */
  v: 1 | 2;
  /** Columns in display order, each with its visibility, sort and filter. */
  columns: TableColumnState[];
  /**
   * Expanded row keys (the string form of each `rowKey`). Present only when row
   * expansion is used with a `rowKey` — without one, expansion can't be serialized.
   */
  expanded?: string[];
  /**
   * State owned by opt-in features, keyed by slice name (`'selection'`, …) — see `TableStateSlice`.
   * Opaque to the table: it round-trips whatever the feature put there, and a slice whose feature
   * isn't imported on restore is simply ignored rather than lost.
   */
  features?: Record<string, unknown>;
};

/**
 * One cell of the spanning group-header row — a maximal run of adjacent visible columns that
 * share a `group` (or a single ungrouped column, with `label: null`).
 */
export type TableHeaderGroup = {
  /** Stable key (the run's first column key). */
  key: string;
  /** The shared group label, or `null` for a run of one ungrouped column. */
  label: string | null;
  /** How many column tracks this run spans. */
  span: number;
};

/** A reference to a row, derived from a consumer-provided `rowKey`, or the row itself. */
export type TableRowKey = (row: unknown) => string | number;
