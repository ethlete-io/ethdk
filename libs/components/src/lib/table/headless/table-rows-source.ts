import { computed, effect, linkedSignal, Signal, WritableSignal } from '@angular/core';
import { TableFilter, TableSort } from '../table.types';

// The client-agnostic core shared by the signals-client (`tableRowsFromQuery`) and legacy-client
// (`tableRowsFromV2Query`) adapters. Each client provides a small "driver" that normalizes its
// query into three signals; the pagination/sort state and row/total bookkeeping live here once.

/** The reactive server-side state the query args are built from. */
export type TableRowsQueryState = {
  /** The active sort (bind the table's `sort` output through `setSort`). */
  sort: Signal<TableSort[]>;
  /** The active filters (bind the table's `filters` output through `setFilters`). */
  filters: Signal<TableFilter[]>;
  /** The current page (1-based by default). */
  page: Signal<number>;
};

/**
 * What `<et-table [rowsSource]>` consumes: rows plus whatever async state and server-side sort/filter
 * plumbing a source happens to expose. Everything but `rows` is optional, so this is satisfied by
 * {@link TableRowsFromQuery} (both the signals-client and legacy-client adapters) **and** by a
 * hand-rolled object — the table depends on the shape, never on `@ethlete/query`.
 *
 * Bound, it feeds `data`, `loading` and `error`, and routes the table's own sort/filter changes back
 * through `setSort`/`setFilters` so the server does the work. That also flips `sortMode`/`filterMode`
 * to `'server'` unless you set them yourself: rows that came back sorted must not be re-sorted here.
 */
export type TableRowsSource<TRow> = {
  /** The rows to render. */
  rows: Signal<readonly TRow[]>;
  /** True while a request is in flight — feeds the table's `loading`. */
  loading?: Signal<boolean>;
  /** The failure, if any — feeds the table's `error` (any non-nullish value counts). */
  error?: Signal<unknown>;
  /** The server-side sort, if the source owns it. */
  sort?: Signal<TableSort[]>;
  /** The server-side filters, if the source owns them. */
  filters?: Signal<TableFilter[]>;
  /** Called instead of updating the table's own `sort` when the user sorts. */
  setSort?: (sort: TableSort[]) => void;
  /** Called instead of updating the table's own `filters` when the user filters. */
  setFilters?: (filters: TableFilter[]) => void;
};

export type TableRowsFromQuery<TRow> = {
  /** Bind to `<et-table [data]>`. Keeps the previous page visible while the next one loads. */
  rows: Signal<TRow[]>;
  /** True while a request is in flight. */
  loading: Signal<boolean>;
  /** The mapped error text, or `null`. */
  error: Signal<string | null>;
  /** Total row count (via `toTotal`), or `null`. */
  total: Signal<number | null>;
  /** Whether more pages exist (via `toHasMore`). */
  hasMore: Signal<boolean>;
  /** The current sort — bind to `<et-table [sort]>`. */
  sort: Signal<TableSort[]>;
  /** The current filters — bind to `<et-table [filters]>`. */
  filters: Signal<TableFilter[]>;
  /** The current page. */
  page: Signal<number>;
  /** Set the sort (wire the table's `(sortChange)`); resets the page to `initialPage`. */
  setSort: (sort: TableSort[]) => void;
  /** Set the filters (wire the table's `(filtersChange)`); resets the page to `initialPage`. */
  setFilters: (filters: TableFilter[]) => void;
  /** Set the page (wire a paginator). */
  setPage: (page: number) => void;
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

export type CreateTableRowsSourceOptions<TResponse, TRow> = {
  driver: TableRowsDriver<TResponse>;
  sort: WritableSignal<TableSort[]>;
  filters: WritableSignal<TableFilter[]>;
  page: WritableSignal<number>;
  initialPage: number;
  toRows: (response: TResponse) => TRow[];
  toTotal?: (response: TResponse) => number;
  toHasMore?: (response: TResponse) => boolean;
};

/** Builds the shared adapter surface from a client driver + the reactive sort/page state. */
export const createTableRowsSource = <TResponse, TRow>(
  options: CreateTableRowsSourceOptions<TResponse, TRow>,
): TableRowsFromQuery<TRow> => {
  const { driver, sort, filters, page, initialPage, toRows, toTotal, toHasMore } = options;

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

  return {
    rows,
    total,
    loading: driver.loading,
    error: driver.errorText,
    hasMore: computed(() => {
      const response = driver.response();

      if (response === null || !toHasMore) {
        return false;
      }

      // A page that came back with no rows has nothing after it, whatever `toHasMore` derives from the
      // response — this is what stops a load-more control from surviving one page past the end when the
      // end can only be inferred (e.g. "a full page means there is more").
      if (toRows(response).length === 0) {
        return false;
      }

      return toHasMore(response);
    }),
    sort: sort.asReadonly(),
    filters: filters.asReadonly(),
    page: page.asReadonly(),
    setSort: (next) => {
      sort.set(next);
      page.set(initialPage);
    },
    setFilters: (next) => {
      filters.set(next);
      page.set(initialPage);
    },
    setPage: (next) => page.set(next),
  };
};
