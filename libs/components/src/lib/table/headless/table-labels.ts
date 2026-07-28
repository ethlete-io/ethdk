import { computed, inject, InjectionToken, Provider, Signal } from '@angular/core';
import { injectLocale } from '@ethlete/core';

/**
 * Every string the table and its features render or announce themselves. Defaults are English
 * ({@link DEFAULT_TABLE_LABELS}); override them app-wide with {@link provideTableLabels} or per table
 * via `et-table`'s `labels` input.
 *
 * The functions take the column's own header text (its `key` when it has no header), so a translation
 * decides the word order rather than having it baked into a concatenation.
 *
 * Anything a consumer would rather build than translate has a template or slot instead — the empty and
 * error states ({@link TableComponent.emptyTemplate}, `[etTableEmpty]`, `[etTableError]`) and filter
 * option content. These are the strings that are left.
 */
export type TableLabels = {
  /** Body text when there are no rows and no empty template/slot is given. */
  empty: string;
  /** Body text when `error` is set and no error template/slot is given. */
  error: string;

  /** Accessible label for a row's expander while the row is collapsed. */
  expandRow: string;
  /** Accessible label for a row's expander while the row is expanded. */
  collapseRow: string;

  /**
   * Accessible name for a sortable column's header button. It announces what the *next* activation
   * does, so it takes the direction that click would apply — `null` meaning "clear the sort".
   */
  sortAction: (header: string, next: 'asc' | 'desc' | null) => string;

  /** Accessible label for a column's filter trigger. */
  filterColumn: (header: string) => string;
  /** Placeholder for a filter menu's search field (`filterSearch` columns). */
  filterSearch: string;
  /** Shown in a filter menu that has no options to offer. */
  filterEmpty: string;
  /** The "fetch the next page of options" button in an async filter menu. */
  filterLoadMore: string;

  /** Accessible label for a column's `⋮` menu trigger. */
  columnMenu: (header: string) => string;
  /** Column-menu entry: sort this column ascending. */
  sortAscending: string;
  /** Column-menu entry: sort this column descending. */
  sortDescending: string;
  /** Column-menu entry: remove this column's sort. */
  clearSort: string;
  /** Column-menu entry: fit this column to its content. */
  autosizeColumn: string;
  /** Column-menu entry: fit every column to its content. */
  autosizeAllColumns: string;
  /** Column-menu entry: drop a resized column's width override. */
  resetWidth: string;
  /** Column-menu entry: hide this column. */
  hideColumn: string;

  /** The column chooser's trigger. */
  columns: string;
  /** The column chooser's "make every column visible again" entry. */
  showAllColumns: string;

  /** Accessible label for the header's select-all checkbox. */
  selectAllRows: string;
  /** Accessible label for a row's selection checkbox. */
  selectRow: string;
};

/** The built-in English labels. */
export const DEFAULT_TABLE_LABELS: TableLabels = {
  empty: 'No data',
  error: 'Could not load data',

  expandRow: 'Expand row',
  collapseRow: 'Collapse row',

  sortAction: (header, next) => {
    if (next === 'asc') return `Sort ${header} ascending`;
    if (next === 'desc') return `Sort ${header} descending`;

    return `Clear sort on ${header}`;
  },

  filterColumn: (header) => `Filter ${header}`,
  filterSearch: 'Search…',
  filterEmpty: 'No options',
  filterLoadMore: 'Load more',

  columnMenu: (header) => `Column options for ${header}`,
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sort',
  autosizeColumn: 'Autosize this column',
  autosizeAllColumns: 'Autosize all columns',
  resetWidth: 'Reset width',
  hideColumn: 'Hide column',

  columns: 'Columns',
  showAllColumns: 'Show all columns',

  selectAllRows: 'Select all rows',
  selectRow: 'Select row',
};

/**
 * A label set, or a function building one for the **active locale** — called again whenever
 * `injectLocale()`'s `currentLocale` changes, so a locale switch re-renders the table's wording
 * without reloading. This is the seam an app's i18n library plugs into (same idea as `TitleConfig`'s
 * locale-aware `transformer`).
 */
export type TableLabelsSource = Partial<TableLabels> | ((locale: string) => Partial<TableLabels>);

/** What {@link provideTableLabels} stores. Read it through {@link injectTableLabels}, not directly. */
export const TABLE_LABELS = new InjectionToken<TableLabelsSource>('TABLE_LABELS', {
  providedIn: 'root',
  factory: () => ({}),
});

/**
 * Localize the table's strings for everything below this injector. Partial — whatever you leave out
 * keeps its {@link DEFAULT_TABLE_LABELS} value.
 *
 * @example
 * // fixed wording
 * provideTableLabels({
 *   empty: 'Keine Daten',
 *   filterSearch: 'Suchen…',
 *   sortAction: (header, next) =>
 *     next === null ? `Sortierung nach ${header} aufheben` : `${header} ${next === 'asc' ? 'aufsteigend' : 'absteigend'} sortieren`,
 * });
 *
 * @example
 * // driven by the app's i18n, re-resolved when `provideLocale()`'s locale changes
 * provideTableLabels((locale) => ({
 *   empty: translate('table.empty', locale),
 *   sortAction: (header, next) => translate(`table.sort.${next ?? 'clear'}`, locale, { header }),
 * }));
 */
export const provideTableLabels = (labels: TableLabelsSource): Provider => ({
  provide: TABLE_LABELS,
  useValue: labels,
});

/**
 * The label set in effect here, as a signal: the defaults with the provided set (or the set its
 * factory builds for the current locale) layered on top. A signal because the locale can change at
 * runtime — read it in the template/computed, never destructure it once.
 */
export const injectTableLabels = (): Signal<TableLabels> => {
  const source = inject(TABLE_LABELS);
  const { currentLocale } = injectLocale();

  return computed(() => ({
    ...DEFAULT_TABLE_LABELS,
    ...(typeof source === 'function' ? source(currentLocale()) : source),
  }));
};
