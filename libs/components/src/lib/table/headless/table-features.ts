import { inject, Injector, InjectionToken, InputSignal, Signal, TemplateRef, Type } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from '../table-errors';
import { TableLabels } from './table-labels';
import { TableColumnDef, TableSortDirection, TableTemplateSlot } from '../table.types';

/**
 * The row-type-independent half of a {@link TableColumnDef} - everything a feature needs to read
 * about the column it renders into, without the row type `T` leaking into the seam (the `T`-typed
 * members are accessors and templates, which no feature touches).
 */
export type TableColumnMeta = Omit<TableColumnDef<never>, 'value' | 'sortValue' | 'filterValue'>;

/**
 * A feature's contribution to every header cell - e.g. the filter menu's trigger, a resize grip.
 * The table stamps `component` into every visible column's header cell, so the feature itself never
 * needs a view of its own (which is what lets features be directives on `<et-table>`).
 */
export type TableHeaderAdornment = {
  /** The component to stamp. It must declare a `column` input to receive the column it renders in. */
  component: Type<{ column: InputSignal<TableColumnMeta> }>;
  /**
   * The injector the stamped component resolves from - pass the feature's own (`inject(Injector)`)
   * so the component can inject the feature that registered it. Defaults to the table's own, which
   * is what the table's built-in cells use.
   */
  injector?: Injector;
  /** Render order within the header cell - lower renders first. @default 0 */
  order?: number;
  /**
   * Whether this contribution is live. A feature registers once, in its constructor, and gates itself
   * with this rather than re-registering - so `[etTableResize]="{ enabled: … }"` can be toggled at
   * runtime. Omitted means always on.
   */
  enabled?: Signal<boolean>;
};

/** A component stamped into a lead column's body cells. It must declare a `row` input. */
export type TableLeadCellComponent = Type<{ row: InputSignal<unknown> }>;

/**
 * A feature's replacement for the mark the table draws in a failed cell (see `cellState`). Stamped
 * only into cells that are actually in the error state, so it costs nothing on a healthy table.
 *
 * This exists so the styled tooltip can stay out of the base bundle: showing a message on hover means
 * the overlay runtime plus floating-ui, which no table should pay for to render a list. The base marks
 * the cell and puts the message in `title`; `etTableCellErrorTooltip` upgrades it.
 */
export type TableCellErrorMark = {
  /** The component to stamp. It must declare a `message` input. */
  component: Type<{ message: InputSignal<string | null> }>;
  /** The injector it resolves from - see {@link TableHeaderAdornment.injector}. */
  injector?: Injector;
  /** Whether the mark is live - see {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * A leading utility column: a fixed-width column before the data columns, with a cell in every row
 * kind (group header, header, body, footer). Selection contributes one; row expansion is the table's
 * own built-in one.
 *
 * The table owns the chrome - track width, sticky offsets, cell classes, ARIA roles - and stamps the
 * registered components into the body/header cells.
 */
export type TableLeadColumn = {
  /** Stable identity, used to track the rendered cells. */
  key: string;
  /** The column's `grid-template-columns` track (e.g. `'var(--et-table-select-width, 32px)'`). */
  width: string;
  /** Lower renders closer to the inline-start edge. @default 0 */
  order?: number;
  /** Extra class put on every cell of this column, for the feature's own styling. */
  cellClass: string;
  /** Header cell content. Omit for an empty, `aria-hidden` header cell. */
  headerComponent?: Type<unknown>;
  /** Body cell content, stamped once per row. */
  bodyComponent: TableLeadCellComponent;
  /** The injector the stamped components resolve from - see {@link TableHeaderAdornment.injector}. */
  injector?: Injector;
  /** Extra class for the whole row, e.g. to mark it selected. */
  rowClass?: (row: unknown) => string | null;
  /** Whether this column is live - see {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * A component the table stamps once, after the grid - a feature's own floating UI, such as the
 * reorder drag ghost and drop indicator. It is the reason a feature needs no view of its own even
 * when it draws something: the table hosts the layer, the feature only supplies the component.
 */
export type TableLayer = {
  component: Type<unknown>;
  /** The injector the layer resolves from - see {@link TableHeaderAdornment.injector}. */
  injector?: Injector;
  /** Whether the layer is live - see {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * How a feature windows the rendered rows (virtual scrolling): the table renders `slice(rows)` with
 * spacers of `paddingStart`/`paddingEnd` standing in for what's left out, and offsets cell indices by
 * `offset` so they stay true row indices.
 */
export type TableRowWindow = {
  slice: (rows: readonly unknown[]) => readonly unknown[];
  paddingStart: Signal<number>;
  paddingEnd: Signal<number>;
  offset: Signal<number>;
  /**
   * Scroll an absolute row index far enough into the viewport that it renders. Without this a windowed
   * table can only be navigated within what is already on screen - keyboard navigation asks the window
   * to bring the target row in, then focuses it once it exists.
   */
  scrollToIndex?: (index: number) => void;
  /** Whether the window is live - when false every row renders. See {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * A feature's claim on cell-level focus (keyboard grid navigation). Registering it is what turns the
 * body's cells into focus targets: the table renders `tabindex="-1"` on every one and stops making the
 * row itself a tab stop, so the grid body becomes the single tab stop the ARIA grid pattern asks for.
 * Which cell currently carries `tabindex="0"` is the feature's to place - see
 * {@link TableFeatureHost.bodyCellElementAt}.
 */
export type TableCellNavigation = {
  /** Whether the claim is live - see {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * A feature's claim on editing a cell in place (inline editing). Registering it lets the table swap a
 * cell's content for the column's `etTableCellEdit` template while that one cell is being edited, and
 * gives keyboard navigation somewhere to hand `Enter` - see {@link TableFeatureHost.editCell}.
 *
 * The feature owns the session (which cell, the draft, commit/cancel); the table only renders it.
 */
export type TableCellEditing = {
  /**
   * The cell currently in edit mode, or `null`. `row` is the row's {@link TableFeatureHost.rowIdentity},
   * `column` its key, and `context` what the column's edit template is rendered with (the feature builds
   * it, since only the feature holds the draft).
   */
  cell: Signal<{ row: unknown; column: string; context: object } | null>;

  /**
   * Put a cell into edit mode, addressed the way {@link TableFeatureHost.bodyCellElementAt} addresses
   * it. Returns whether the feature took it - `false` for a column that isn't editable, which is what
   * lets `Enter` fall through to its usual job of drilling into the cell's content.
   */
  editCell(rowIndex: number, columnIndex: number): boolean;

  /** Whether the claim is live - see {@link TableHeaderAdornment.enabled}. */
  enabled?: Signal<boolean>;
};

/**
 * A feature's own serializable state, contributed to the table's {@link TableState} under `key`.
 *
 * The base table owns column order/visibility/width, sort, filters and expansion because they must
 * round-trip whether or not a feature is imported. Anything a *feature* owns (a selection) can't live
 * there without the base knowing about the feature - so the feature hands over a slice instead, and
 * `state()` / `restoreState()` carry it as opaque JSON.
 */
export type TableStateSlice = {
  /** Stable name of the slice in the serialized state, e.g. `'selection'`. */
  key: string;
  /** The value to serialize. Anything `JSON.stringify` handles. */
  read(): unknown;
  /** Apply a previously serialized value. Called with whatever `read` produced (never `undefined`). */
  write(value: unknown): void;
};

/**
 * What an opt-in table feature can reach on its host table. Features **register** themselves here
 * (the table never queries for them), which is what keeps the base table free of any reference to a
 * feature's dependencies - a table without `etTableFilters` never pulls in the menu system.
 *
 * Serializable state (column order/visibility/width, sort, filters, expansion) stays owned by the
 * base table so `state()` / `restoreState()` round-trip regardless of which features are imported;
 * features read and write it through this contract.
 */
export type TableFeatureHost = {
  /** Add a component to every header cell. Call once, from the feature's constructor. */
  registerHeaderAdornment(adornment: TableHeaderAdornment): void;
  /** Add a leading utility column. Call once, from the feature's constructor. */
  registerLeadColumn(column: TableLeadColumn): void;
  /** Window the rendered rows (virtual scrolling). Call once, from the feature's constructor. */
  registerRowWindow(window: TableRowWindow): void;
  /** Take over cell focus (keyboard grid navigation). Call once, from the feature's constructor. */
  registerCellNavigation(navigation: TableCellNavigation): void;
  /** Take over editing a cell in place. Call once, from the feature's constructor. */
  registerCellEditing(editing: TableCellEditing): void;
  /** Add a floating layer rendered after the grid (a drag ghost). Call once, from the constructor. */
  registerLayer(layer: TableLayer): void;
  /** Replace the mark drawn in failed cells. Call once, from the feature's constructor. */
  registerCellErrorMark(mark: TableCellErrorMark): void;
  /** Contribute the feature's own serializable state. Call once, from the feature's constructor. */
  registerStateSlice(slice: TableStateSlice): void;

  /**
   * The wording in effect on this table - the injected {@link TABLE_LABELS} set with the table's own
   * `labels` input applied. A feature renders no string of its own: it reads them from here, so one
   * `provideTableLabels` (or one `labels` binding) localizes the table and every feature on it.
   */
  resolvedLabels(): TableLabels;

  /**
   * A template a consumer registered for one of a column's slots, or `null`. A feature that renders
   * part of a column (the filter menu's options) offers the same templating the base table does,
   * without owning a registry of its own.
   */
  columnTemplate(slot: TableTemplateSlot, key: string): TemplateRef<unknown> | null;

  /** The rows the table would render, after client filtering/sorting. */
  rows(): readonly unknown[];
  /** Stable identity for a row - `rowKey`'s string form, else the row reference. */
  rowIdentity(row: unknown): unknown;
  /** A rendered body cell, for a feature that needs to measure real row height. */
  firstBodyCellElement(): HTMLElement | null;

  /**
   * The rendered body cell at an absolute row index and a visible-column index, or `null` when that row
   * is outside a virtual window's rendered range. Pair it with {@link scrollRowIntoView}, which is what
   * makes the row exist in the first place.
   */
  bodyCellElementAt(rowIndex: number, columnIndex: number): HTMLElement | null;

  /**
   * Every rendered body cell, rows major - the list {@link bodyCellElementAt} indexes into. A feature
   * that has to turn an event back into a cell finds it here (`event.composedPath()`), rather than
   * walking the DOM.
   */
  bodyCellElements(): HTMLElement[];

  /**
   * Absolute index of the first rendered row - nonzero only while a window is in play. What turns a
   * position within {@link bodyCellElements} back into an index into {@link rows}.
   */
  renderedRowOffset(): number;

  /**
   * Bring an absolute row index into the viewport - through the registered row window when there is
   * one (which also renders it), else by scrolling the rendered row element into view. Returns whether
   * a windowed scroll happened, i.e. whether the caller must wait for a render before the row exists.
   */
  scrollRowIntoView(rowIndex: number): boolean;

  /** How many rows fit the scroll viewport - the step PageUp/PageDown moves by. At least 1. */
  rowsPerPage(): number;

  /**
   * Hand a cell to a registered editing feature, if one wants it - see {@link TableCellEditing.editCell}.
   * Returns `false` when nothing took it (no feature, or the column isn't editable), which is the
   * signal for the caller to do whatever it would have done with the key otherwise.
   *
   * This is the contract between keyboard navigation and inline editing over `Enter`: navigation asks
   * first and only drills into the cell's content when the answer is no. Neither feature references the
   * other - both go through the table, as every other pair of features does.
   */
  editCell(rowIndex: number, columnIndex: number): boolean;

  /**
   * The table's host element - a feature is a directive on it, so this is also the element it can
   * listen on, measure or mark. `<et-table>`'s own DOM is inside it.
   */
  readonly element: HTMLElement;

  /** The selected filter values for a column key (empty when unfiltered). */
  filterValuesFor(key: string): unknown[];
  /** Replace a column's selected filter values (an empty list clears the filter). */
  setFilterValues(key: string, values: unknown[]): void;

  /** The visible columns, in render order - what a feature hit-tests or iterates over. */
  visibleColumnsMeta(): TableColumnMeta[];
  /**
   * The rendered header cells of the visible columns, in the same order as `visibleColumnsMeta()`.
   * A feature that must attach behavior to cells the table renders (a reorder drag) works from these.
   */
  headerCellElements(): HTMLElement[];
  /** The rendered body cells of one column, e.g. to animate a column into its new position. */
  bodyCellElementsFor(key: string): HTMLElement[];
  /** A column's effective pinning - `null` when unpinned or when pinning is currently suppressed. */
  effectiveStickyOf(key: string): 'start' | 'end' | null;
  /** Move a column next to another one in the full column order (hidden columns stay put). */
  moveColumnNextTo(key: string, target: { overKey: string; before: boolean }): void;

  /** The column's current rendered header width in px - the baseline a resize drag starts from. */
  renderedColumnWidth(key: string): number;
  /** Override a column's width in px. The table clamps it to a usable range and stores it in `state()`. */
  setColumnWidth(key: string, width: number): void;
  /** Drop a column's width override, returning it to the width its definition asks for. */
  resetColumnWidth(key: string): void;
  /** Whether the column carries a width override - i.e. whether there is one to reset. */
  hasColumnWidthOverride(key: string): boolean;
  /** Fit these columns to their widest rendered content, keeping the result as a width override. */
  autosizeColumns(keys: readonly string[]): void;

  /** A column's sort direction, or `null` when it isn't sorted. */
  sortDirection(key: string): TableSortDirection | null;
  /** Set a column's sort direction outright, or clear it with `null`. Honours `multiSort`. */
  setSort(key: string, direction: TableSortDirection | null): void;
  /** Show or hide a column. */
  setColumnVisible(key: string, visible: boolean): void;
  /** Every declared column in order, hidden ones included - what a "choose columns" panel lists. */
  allColumns(): TableColumnMeta[];
  /** Whether a column is currently shown. */
  isColumnVisible(key: string): boolean;
  /** Show every hidden column again. */
  showAllColumns(): void;
};

export const TABLE_FEATURE_HOST = new InjectionToken<TableFeatureHost>('TABLE_FEATURE_HOST');

/** Options every feature accepts on top of its own. */
export type TableFeatureConfig = {
  /**
   * Turn the feature off without removing it - a directive can't be applied conditionally, so this is
   * how `[etTableResize]="{ enabled: canResize() }"` toggles at runtime. @default true
   */
  enabled?: boolean;
};

/**
 * Read a feature's config input. A feature directive is usually written bare (`etTableResize`), which
 * Angular binds as the empty string - normalize that to "no options given".
 */
export const tableFeatureConfig = <TConfig extends TableFeatureConfig>(value: TConfig | '') =>
  value === '' ? ({} as TConfig) : value;

/**
 * Inject the host table from inside a feature. Throws a labelled error when the feature was placed
 * outside an `<et-table>`, where it could only ever silently do nothing.
 */
export const injectTableFeatureHost = (feature: string): TableFeatureHost => {
  const host = inject(TABLE_FEATURE_HOST, { optional: true });

  if (!host) {
    throw new RuntimeError(TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE, `[${feature}] must be used inside an <et-table>.`);
  }

  return host;
};
