import { effect, linkedSignal, signal, Signal, WritableSignal } from '@angular/core';
import { TableFilter, TableSort } from '../table.types';

// The client-agnostic core shared by the signals-client (`tableRowsFromQuery`) and legacy-client
// (`tableRowsFromV2Query`) adapters. Each client provides a small "driver" that normalizes its
// query into three signals; the pagination/sort state and row/total bookkeeping live here once.

/** The reactive server-side state the query args are built from. */
export type TableRowsQueryState<TKey extends string = string> = {
  /** The active sort (bind the table's `sort` output through `setSort`). */
  sort: Signal<TableSort<TKey>[]>;
  /** The active filters (bind the table's `filters` output through `setFilters`). */
  filters: Signal<TableFilter<TKey>[]>;
  /** The current page (1-based by default). */
  page: Signal<number>;
  /** The rows per page (feed it through `setPageSize`). */
  pageSize: Signal<number>;
  /** The free-text search (feed it through `setQuickFilter`), for the backend to match rows against. */
  quickFilter: Signal<string>;
};

/**
 * The state options both query adapters share. Each piece of state is either created internally from
 * its `initial*` value or, when an existing writable signal is passed (a query form field's `value`,
 * say), read and written through that signal instead.
 */
export type TableRowsStateConfig<TKey extends string = string> = {
  /** Initial sort. @default [] */
  initialSort?: TableSort<TKey>[];
  /** Initial filters. @default [] */
  initialFilters?: TableFilter<TKey>[];
  /** Initial free-text search. @default '' */
  initialQuickFilter?: string;
  /** The page `args` receives on first load; `setSort`/`setFilters`/`setQuickFilter`/`setPageSize` reset to it. @default 1 */
  initialPage?: number;
  /** Initial rows per page. @default 25 */
  initialPageSize?: number;
  /** An existing sort signal to use instead of an internal one. `initialSort` is ignored. */
  sort?: WritableSignal<TableSort<TKey>[]>;
  /** An existing filters signal to use instead of an internal one. `initialFilters` is ignored. */
  filters?: WritableSignal<TableFilter<TKey>[]>;
  /** An existing page signal to use instead of an internal one. The setters still reset it to `initialPage`. */
  page?: WritableSignal<number>;
  /** An existing page-size signal to use instead of an internal one. `initialPageSize` is ignored. */
  pageSize?: WritableSignal<number>;
  /** An existing free-text search signal to use instead of an internal one. `initialQuickFilter` is ignored. */
  quickFilter?: WritableSignal<string>;
};

/** Resolves {@link TableRowsStateConfig} into the writable signals the core works on. */
export const createTableRowsState = <TKey extends string>(config: TableRowsStateConfig<TKey>) => {
  const initialPage = config.initialPage ?? 1;

  return {
    initialPage,
    sort: config.sort ?? signal<TableSort<TKey>[]>(config.initialSort ?? []),
    filters: config.filters ?? signal<TableFilter<TKey>[]>(config.initialFilters ?? []),
    page: config.page ?? signal(initialPage),
    pageSize: config.pageSize ?? signal(config.initialPageSize ?? 25),
    quickFilter: config.quickFilter ?? signal(config.initialQuickFilter ?? ''),
  };
};

/**
 * What `<et-table [rowsSource]>` consumes: rows plus whatever async state and server-side sort/filter
 * plumbing a source happens to expose. Everything but `rows` is optional, so this is satisfied by
 * {@link TableRowsFromQuery} (both the signals-client and legacy-client adapters) **and** by a
 * hand-rolled object - the table depends on the shape, never on `@ethlete/query`.
 *
 * Bound, it feeds `data`, `loading` and `error`, and routes the table's own sort/filter changes back
 * through `setSort`/`setFilters` so the server does the work. That also flips `sortMode`/`filterMode`
 * to `'server'` unless you set them yourself: rows that came back sorted must not be re-sorted here.
 */
export type TableRowsSource<TRow, TKey extends string = string> = {
  /** The rows to render. */
  rows: Signal<readonly TRow[]>;
  /** True while a request is in flight - feeds the table's `loading`. */
  loading?: Signal<boolean>;
  /** The failure, if any - feeds the table's `error` (any non-nullish value counts). */
  error?: Signal<unknown>;
  /**
   * How many rows the server holds in total, when the source knows - `null` while it doesn't. Nothing
   * renders it; it is what lets a [CSV export](/components/table#exporting-more-than-the-loaded-page)
   * notice that the table is holding 20 of 4 312 rows and say so instead of writing a plausible,
   * wrong file. {@link TableRowsFromQuery} already provides it.
   */
  total?: Signal<number | null>;
  /** The server-side sort, if the source owns it. */
  sort?: Signal<TableSort<TKey>[]>;
  /** The server-side filters, if the source owns them. */
  filters?: Signal<TableFilter<TKey>[]>;
  /** Called instead of updating the table's own `sort` when the user sorts. Keys are each column's `sortKey`, else its key. */
  setSort?: (sort: TableSort<TKey>[]) => void;
  /** Called instead of updating the table's own `filters` when the user filters. Keys are each column's `filterKey`, else its key. */
  setFilters?: (filters: TableFilter<TKey>[]) => void;
};

export type TableRowsFromQuery<TRow, TKey extends string = string> = {
  /** The current page's rows. Keeps the previous page visible while the next one loads. */
  rows: Signal<TRow[]>;
  /** True while a request is in flight. */
  loading: Signal<boolean>;
  /** The mapped error text, or `null`. */
  error: Signal<string | null>;
  /** Total row count (via `toTotal`), or `null`. */
  total: Signal<number | null>;
  /** Whether more pages exist (via `toHasMore`). */
  hasMore: Signal<boolean>;
  /** The current sort. */
  sort: Signal<TableSort<TKey>[]>;
  /** The current filters. */
  filters: Signal<TableFilter<TKey>[]>;
  /** The current page. */
  page: Signal<number>;
  /** The current rows per page. */
  pageSize: Signal<number>;
  /** The current free-text search. */
  quickFilter: Signal<string>;
  /** Set the sort; resets the page to `initialPage`. A table bound through `[rowsSource]` calls it. */
  setSort: (sort: TableSort<TKey>[]) => void;
  /** Set the filters; resets the page to `initialPage`. A table bound through `[rowsSource]` calls it. */
  setFilters: (filters: TableFilter<TKey>[]) => void;
  /** Set the page (wire a paginator). */
  setPage: (page: number) => void;
  /** Set the rows per page (wire a page-size select); resets the page to `initialPage`. */
  setPageSize: (pageSize: number) => void;
  /** Set the free-text search (wire a search field); resets the page to `initialPage`. */
  setQuickFilter: (quickFilter: string) => void;
};

/** A per-client view of a running query, normalized to three signals. */
export type TableRowsDriver<TResponse> = {
  /** The latest settled response, or `null` while loading/failed (the core keeps the previous rows). */
  response: Signal<TResponse | null>;
  /** True while a request is in flight. */
  loading: Signal<boolean>;
  /** The failure mapped to text, or `null`. */
  errorText: Signal<string | null>;
};

export type CreateTableRowsSourceOptions<TResponse, TRow, TKey extends string = string> = {
  driver: TableRowsDriver<TResponse>;
  sort: WritableSignal<TableSort<TKey>[]>;
  filters: WritableSignal<TableFilter<TKey>[]>;
  page: WritableSignal<number>;
  pageSize?: WritableSignal<number>;
  quickFilter?: WritableSignal<string>;
  initialPage: number;
  toRows: (response: TResponse) => TRow[];
  toTotal?: (response: TResponse) => number;
  toHasMore?: (response: TResponse) => boolean;
};

/** Builds the shared adapter surface from a client driver + the reactive sort/page state. */
export const createTableRowsSource = <TResponse, TRow, TKey extends string = string>(
  options: CreateTableRowsSourceOptions<TResponse, TRow, TKey>,
): TableRowsFromQuery<TRow, TKey> => {
  const { driver, sort, filters, page, initialPage, toRows, toTotal, toHasMore } = options;
  const quickFilter = options.quickFilter ?? signal('');
  const pageSize = options.pageSize ?? signal(25);

  // Keep the previous page's rows while the next request is in flight (driver.response is null
  // between executions) so the table doesn't flash empty. linkedSignal folds synchronously on read.
  const rows = linkedSignal<TResponse | null, TRow[]>({
    source: () => driver.response(),
    computation: (response, previous) => (response === null ? (previous?.value ?? []) : toRows(response)),
  });
  // Fold even when nothing observes `rows` (e.g. between renders).
  effect(() => void rows());

  const total = linkedSignal<TResponse | null, number | null>({
    source: () => driver.response(),
    computation: (response, previous) =>
      response === null ? (previous?.value ?? null) : (toTotal?.(response) ?? null),
  });
  effect(() => void total());

  const hasMore = linkedSignal<TResponse | null, boolean>({
    source: () => driver.response(),
    computation: (response, previous) => {
      if (response === null) return previous?.value ?? false;
      if (!toHasMore) return false;

      // A page that came back with no rows has nothing after it, whatever `toHasMore` derives from the
      // response - this is what stops a load-more control from surviving one page past the end when the
      // end can only be inferred (e.g. "a full page means there is more").
      if (rows().length === 0) return false;

      return toHasMore(response);
    },
  });
  effect(() => void hasMore());

  return {
    rows,
    total,
    loading: driver.loading,
    error: driver.errorText,
    hasMore,
    sort: sort.asReadonly(),
    filters: filters.asReadonly(),
    page: page.asReadonly(),
    pageSize: pageSize.asReadonly(),
    quickFilter: quickFilter.asReadonly(),
    setSort: (next) => {
      sort.set(next);
      page.set(initialPage);
    },
    setFilters: (next) => {
      filters.set(next);
      page.set(initialPage);
    },
    setPage: (next) => page.set(next),
    setPageSize: (next) => {
      pageSize.set(next);
      page.set(initialPage);
    },
    setQuickFilter: (next) => {
      quickFilter.set(next);
      page.set(initialPage);
    },
  };
};
