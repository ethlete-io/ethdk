import { computed } from '@angular/core';
import {
  AnyLegacyQuery,
  AnyLegacyQueryCreator,
  AnyV2Query,
  AnyV2QueryCreator,
  QueryDataOf,
  RequestError,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  queryComputed,
  queryStateSignal,
} from '@ethlete/query';
import { injectTableLabels } from './table-labels';
import {
  createTableRowsSource,
  createTableRowsState,
  TableRowsFromQuery,
  TableRowsQueryState,
  TableRowsStateConfig,
} from './table-rows-source';
import { TableSourceKeyOf } from '../table.types';

// The legacy twin of `table-rows-from-query.ts` for apps still on the class-based `V2QueryClient`.
// Same module rules: standalone function in its own file so unused integrations tree-shake away.

export type TableRowsFromV2QueryConfig<
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TRow,
  TColumns extends object = Record<string, unknown>,
> = TableRowsStateConfig<TableSourceKeyOf<TColumns>> & {
  /** The legacy query creator to run. A fresh query is prepared/executed as sort/page change; the previous is released. */
  queryCreator: TCreator;
  /** Builds the `prepare()` args from the reactive server state. Return `null` to skip (rows keep their previous value). */
  args: (state: TableRowsQueryState<TableSourceKeyOf<TColumns>>) => Parameters<TCreator['prepare']>[0] | null;
  /** Maps a successful response to the current page's rows. */
  toRows: (response: QueryDataOf<TCreator>) => TRow[];
  /** Total row count across all pages, for a paginator. */
  toTotal?: (response: QueryDataOf<TCreator>) => number;
  /** Whether more pages exist (gates a "load more"/next control). */
  toHasMore?: (response: QueryDataOf<TCreator>) => boolean;
  /** Turns a query failure into the table's error text. Defaults to the first error message. */
  toErrorMessage?: (error: RequestError) => string;
  /**
   * The table's columns. Types the keys `sort`, `filters` and the setters carry - each column's
   * `sortKey` / `filterKey`, else its key (see `TableSourceKeyOf`). Nothing reads it at runtime.
   */
  columns?: TColumns;
};

const firstErrorMessage = (error: RequestError, fallback: string) => {
  const detail = error.detail;

  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof detail.message === 'string') return detail.message;
    if ('detail' in detail && typeof detail.detail === 'string') return detail.detail;
  }

  if (typeof detail === 'string') return detail;

  return error.statusText || fallback;
};

/**
 * The `V2QueryClient` counterpart of {@link tableRowsFromQuery}, for apps still on the legacy
 * client. Returns the same signal bundle - bind it as the table's `rowsSource` the same way. Uses the legacy `queryComputed` container idiom: it re-prepares as sort/page
 * change and releases the previous query.
 *
 * Call it from a field initializer / constructor (injection context).
 */
export const tableRowsFromV2Query = <
  TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator,
  TRow,
  TColumns extends object = Record<string, unknown>,
>(
  config: TableRowsFromV2QueryConfig<TCreator, TRow, TColumns>,
): TableRowsFromQuery<TRow, TableSourceKeyOf<TColumns>> => {
  type TResponse = QueryDataOf<TCreator>;
  type TKey = TableSourceKeyOf<TColumns>;

  const { initialPage, sort, filters, page, pageSize, quickFilter } = createTableRowsState<TKey>(config);

  const query = queryComputed<AnyV2Query | AnyLegacyQuery | null>(() => {
    const args = config.args({ sort, filters, page, pageSize, quickFilter });

    if (args === null) return null;

    return config.queryCreator.prepare(args).execute() as AnyV2Query | AnyLegacyQuery;
  });

  const state = queryStateSignal(query);
  // Keeps the previous response available while the next request loads (see the select twin).
  const settled = queryStateSignal(query, { cacheResponse: true });
  const labels = injectTableLabels();
  const toErrorMessage = config.toErrorMessage ?? ((error) => firstErrorMessage(error, labels().error));

  return createTableRowsSource<TResponse, TRow, TKey>({
    driver: {
      response: computed(() => {
        const current = settled();

        return isQueryStateSuccess(current) ? (current.response as TResponse) : null;
      }),
      loading: computed(() => isQueryStateLoading(state())),
      errorText: computed(() => {
        const current = state();

        return isQueryStateFailure(current) ? toErrorMessage(current.error) : null;
      }),
    },
    sort,
    filters,
    page,
    pageSize,
    quickFilter,
    initialPage,
    toRows: config.toRows,
    toTotal: config.toTotal,
    toHasMore: config.toHasMore,
  });
};
