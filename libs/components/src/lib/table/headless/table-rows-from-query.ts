import { computed, signal } from '@angular/core';
import { AnyQueryCreator, QueryArgsOf, QueryErrorResponse, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { injectTableLabels } from './table-labels';
import { createTableRowsSource, TableRowsFromQuery, TableRowsQueryState } from './table-rows-source';
import { TableFilter, TableSort } from '../table.types';

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
  /** Initial filters. @default [] */
  initialFilters?: TableFilter[];
  /** Initial free-text search. @default '' */
  initialQuickFilter?: string;
  /** The page `args` receives on first load; `setSort`/`setFilters`/`setQuickFilter` reset to it. @default 1 */
  initialPage?: number;
};

const firstErrorMessage = (error: QueryErrorResponse, fallback: string) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText ?? fallback;
};

/**
 * Feeds a table's rows from an `@ethlete/query` query, server-side. Mirroring `createQueryStack`,
 * it takes the `queryCreator` plus a reactive `args` builder: the query is created once and
 * re-executes as sort/page change. Bound as a table's `rowsSource`, the backend does the sorting and
 * filtering:
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
 * <et-table [rowsSource]="users" [columns]="columns" />
 * ```
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd create a
 * query or a query stack. For the legacy `V2QueryClient`, use `tableRowsFromV2Query`.
 */
export const tableRowsFromQuery = <TCreator extends AnyQueryCreator, TRow>(
  config: TableRowsFromQueryConfig<TCreator, TRow>,
): TableRowsFromQuery<TRow> => {
  type TArgs = QueryArgsOf<TCreator>;
  type TResponse = ResponseType<TArgs>;

  const initialPage = config.initialPage ?? 1;
  const sort = signal<TableSort[]>(config.initialSort ?? []);
  const filters = signal<TableFilter[]>(config.initialFilters ?? []);
  const page = signal(initialPage);
  const quickFilter = signal(config.initialQuickFilter ?? '');

  // Created once - `withArgs` re-runs as sort/filters/page change.
  const query = config.queryCreator(withArgs<TArgs>(() => config.args({ sort, filters, page, quickFilter }) ?? null));
  const labels = injectTableLabels();
  const toErrorMessage = config.toErrorMessage ?? ((error) => firstErrorMessage(error, labels().error));

  return createTableRowsSource<TResponse, TRow>({
    driver: {
      response: computed(() => query.response()),
      loading: computed(() => query.loading() !== null),
      errorText: computed(() => {
        const error = query.error();

        return error === null ? null : toErrorMessage(error);
      }),
    },
    sort,
    filters,
    page,
    quickFilter,
    initialPage,
    toRows: config.toRows,
    toTotal: config.toTotal,
    toHasMore: config.toHasMore,
  });
};
