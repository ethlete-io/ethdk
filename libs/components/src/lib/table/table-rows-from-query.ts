import { computed, effect, linkedSignal, Signal, signal } from '@angular/core';
import { AnyQueryCreator, QueryArgsOf, QueryErrorResponse, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { TableSort } from './table.types';

// Note: `@ethlete/components` intentionally depends on `@ethlete/query`, so this query-aware
// convenience factory lives here. It's a standalone function in its own module — tables that don't
// use it (and apps not using `@ethlete/query`) tree-shake it away.

/** The reactive server-side state the query args are built from. */
export type TableRowsQueryState = {
  /** The active sort (bind the table's `sort` output through `setSort`). */
  sort: Signal<TableSort[]>;
  /** The current page (1-based by default). */
  page: Signal<number>;
};

export type TableRowsFromQueryConfig<TCreator extends AnyQueryCreator, TRow> = {
  /** The query creator to run. Created **once** and re-executes reactively as sort/page change. */
  queryCreator: TCreator;
  /**
   * Builds the request args from the reactive server state. Runs like `withArgs`: reading
   * `sort()`/`page()` re-executes the query. Return `null` to skip a request (rows keep their
   * previous value).
   */
  args: (state: TableRowsQueryState) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /** Maps a successful response to the current page's rows. */
  toRows: (response: ResponseType<QueryArgsOf<TCreator>>) => TRow[];
  /** Total row count across all pages, for a paginator. */
  toTotal?: (response: ResponseType<QueryArgsOf<TCreator>>) => number;
  /** Whether more pages exist (gates a "load more"/next control). */
  toHasMore?: (response: ResponseType<QueryArgsOf<TCreator>>) => boolean;
  /** Turns a query failure into the table's error text. Defaults to the first error message. */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Initial sort. @default [] */
  initialSort?: TableSort[];
  /** The page `args` receives on first load; `setSort` resets to it. @default 1 */
  initialPage?: number;
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
  /** The current page. */
  page: Signal<number>;
  /** Set the sort (wire the table's `(sortChange)`); resets the page to `initialPage`. */
  setSort: (sort: TableSort[]) => void;
  /** Set the page (wire a paginator). */
  setPage: (page: number) => void;
};

const firstErrorMessage = (error: QueryErrorResponse) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText ?? 'Something went wrong';
};

/**
 * Feeds a table's rows from an `@ethlete/query` query, server-side. Mirroring `createQueryStack`
 * (and `selectOptionsFromQuery`), it takes the `queryCreator` plus a reactive `args` builder: the
 * query is created once and re-executes as sort/page change. Use it with the table's
 * `sortMode="server"` so the backend does the sorting:
 *
 * ```ts
 * users = tableRowsFromQuery({
 *   queryCreator: getUsers,
 *   args: ({ sort, page }) => ({
 *     queryParams: { sortBy: sort()[0]?.key, sortOrder: sort()[0]?.direction, page: page() },
 *   }),
 *   toRows: (res) => res.items,
 *   toTotal: (res) => res.totalHits,
 * });
 * ```
 *
 * ```html
 * <et-table
 *   [data]="users.rows()"
 *   [columns]="columns"
 *   [sort]="users.sort()"
 *   (sortChange)="users.setSort($event)"
 *   sortMode="server"
 * />
 * ```
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd create a
 * query or a query stack.
 */
export const tableRowsFromQuery = <TCreator extends AnyQueryCreator, TRow>(
  config: TableRowsFromQueryConfig<TCreator, TRow>,
): TableRowsFromQuery<TRow> => {
  type TArgs = QueryArgsOf<TCreator>;

  const initialPage = config.initialPage ?? 1;
  const sort = signal<TableSort[]>(config.initialSort ?? []);
  const page = signal(initialPage);

  // Created once — `withArgs` re-runs as sort/page change.
  const query = config.queryCreator(withArgs<TArgs>(() => config.args({ sort, page }) ?? null));

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  // Keep the previous page's rows while the next request is in flight (response() is null between
  // executions) so the table doesn't flash empty. linkedSignal folds synchronously on read.
  const rows = linkedSignal<ResponseType<TArgs> | null, TRow[]>({
    source: () => query.response(),
    computation: (response, previous) => (response === null ? (previous?.value ?? []) : config.toRows(response)),
  });
  // Fold even when nothing observes `rows` (e.g. between renders).
  effect(() => void rows());

  const total = linkedSignal<ResponseType<TArgs> | null, number | null>({
    source: () => query.response(),
    computation: (response, previous) =>
      response === null ? (previous?.value ?? null) : (config.toTotal?.(response) ?? null),
  });
  effect(() => void total());

  return {
    rows,
    total,
    loading: computed(() => query.loading() !== null),
    error: computed(() => {
      const error = query.error();

      return error === null ? null : toErrorMessage(error);
    }),
    hasMore: computed(() => {
      const response = query.response();

      return response === null || !config.toHasMore ? false : config.toHasMore(response);
    }),
    sort: sort.asReadonly(),
    page: page.asReadonly(),
    setSort: (next) => {
      sort.set(next);
      page.set(initialPage);
    },
    setPage: (next) => page.set(next),
  };
};
