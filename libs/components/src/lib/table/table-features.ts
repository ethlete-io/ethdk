import { inject, InjectionToken, Signal, TemplateRef } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableColumn } from './table.types';

/**
 * The row-type-independent half of a {@link TableColumn} — everything a feature needs to read about
 * the column it renders into, without the row type `T` leaking into the seam (the `T`-typed members
 * are accessors and templates, which no feature touches).
 */
export type TableColumnMeta = Omit<
  TableColumn<never, unknown>,
  'value' | 'sortValue' | 'filterValue' | 'cell' | 'headerCell' | 'footerCell'
>;

/** The context a header-adornment template receives: the column it is rendering in. */
export type TableHeaderAdornmentContext = {
  $implicit: TableColumnMeta;
};

/**
 * A feature's contribution to every header cell — e.g. the filter menu's trigger, a resize grip.
 * The table renders `template()` once per visible column; `undefined` renders nothing, so a feature
 * whose view hasn't been created yet (or which has nothing to add) simply stays invisible.
 */
export type TableHeaderAdornment = {
  template: Signal<TemplateRef<TableHeaderAdornmentContext> | undefined>;
  /** Render order within the header cell — lower renders first. @default 0 */
  order?: number;
};

/** The context a lead column's body-cell template receives: the row that cell belongs to. */
export type TableLeadCellContext = {
  /** The row. Untyped here — the seam is row-type agnostic; pair it with `rowIdentity`. */
  $implicit: unknown;
};

/**
 * A leading utility column: a fixed-width column before the data columns, with a cell in every row
 * kind (group header, header, body, footer). Selection contributes one; row expansion is the table's
 * own built-in one.
 *
 * The table owns the chrome — track width, sticky offsets, cell classes, ARIA roles — and stamps the
 * feature's templates into the body/header cells.
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
  headerCell?: Signal<TemplateRef<unknown> | undefined>;
  /** Body cell content, rendered once per row. */
  bodyCell: Signal<TemplateRef<TableLeadCellContext> | undefined>;
  /** Extra class for the whole row, e.g. to mark it selected. */
  rowClass?: (row: unknown) => string | null;
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
};

/**
 * What an opt-in table feature can reach on its host table. Features **register** themselves here
 * (they are never queried with `contentChild`), which is what keeps the base table free of any
 * reference to a feature's dependencies — a table without `<et-table-filters>` never pulls in the
 * menu system.
 *
 * Serializable state (column order/visibility/width, sort, filters, expansion) stays owned by the
 * base table so `state()` / `restoreState()` round-trip regardless of which features are imported;
 * features read and write it through this contract.
 */
export type TableFeatureHost = {
  /** Add UI to every header cell. Call once, from the feature's constructor. */
  registerHeaderAdornment(adornment: TableHeaderAdornment): void;
  /** Add a leading utility column. Call once, from the feature's constructor. */
  registerLeadColumn(column: TableLeadColumn): void;
  /** Window the rendered rows (virtual scrolling). Call once, from the feature's constructor. */
  registerRowWindow(window: TableRowWindow): void;

  /** The rows the table would render, after client filtering/sorting. */
  rows(): readonly unknown[];
  /** Stable identity for a row — `rowKey`'s string form, else the row reference. */
  rowIdentity(row: unknown): unknown;
  /** A rendered body cell, for a feature that needs to measure real row height. */
  firstBodyCellElement(): HTMLElement | null;

  /**
   * The table's host element. A feature is content of `<et-table>` but is never projected, so its own
   * host element is not in the DOM — anything that needs to listen on, measure or mark the table works
   * from this.
   */
  readonly element: HTMLElement;

  /** The selected filter values for a column key (empty when unfiltered). */
  filterValuesFor(key: string): unknown[];
  /** Replace a column's selected filter values (an empty list clears the filter). */
  setFilterValues(key: string, values: unknown[]): void;

  /** The visible columns, in render order — what a feature hit-tests or iterates over. */
  visibleColumnsMeta(): TableColumnMeta[];
  /**
   * The rendered header cells of the visible columns, in the same order as `visibleColumnsMeta()`.
   * A feature that must attach behavior to cells the table renders (a reorder drag) works from these.
   */
  headerCellElements(): HTMLElement[];
  /** The rendered body cells of one column, e.g. to animate a column into its new position. */
  bodyCellElementsFor(key: string): HTMLElement[];
  /** A column's effective pinning — `null` when unpinned or when pinning is currently suppressed. */
  effectiveStickyOf(key: string): 'start' | 'end' | null;
  /** Move a column next to another one in the full column order (hidden columns stay put). */
  moveColumnNextTo(key: string, target: { overKey: string; before: boolean }): void;

  /** The column's current rendered header width in px — the baseline a resize drag starts from. */
  renderedColumnWidth(key: string): number;
  /** Override a column's width in px. The table clamps it to a usable range and stores it in `state()`. */
  setColumnWidth(key: string, width: number): void;
  /** Drop a column's width override, returning it to the width its definition asks for. */
  resetColumnWidth(key: string): void;
};

export const TABLE_FEATURE_HOST = new InjectionToken<TableFeatureHost>('TABLE_FEATURE_HOST');

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
