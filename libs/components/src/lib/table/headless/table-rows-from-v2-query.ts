import { computed, signal } from '@angular/core';
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
import { createTableRowsSource, TableRowsFromQuery, TableRowsQueryState } from './table-rows-source';
import { TableFilter, TableSort } from '../table.types';

// The legacy twin of `table-rows-from-query.ts` for apps still on the class-based `V2QueryClient`.
// Same module rules: standalone function in its own file so unused integrations tree-shake away.

export type TableRowsFromV2QueryConfig<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TRow> = {
  /** The legacy query creator to run. A fresh query is prepared/executed as sort/page change; the previous is released. */
  queryCreator: TCreator;
  /** Builds the `prepare()` args from the reactive server state. Return `null` to skip (rows keep their previous value). */
  args: (state: TableRowsQueryState) => Parameters<TCreator['prepare']>[0] | null;
  /** Maps a successful response to the current page's rows. */
  toRows: (response: QueryDataOf<TCreator>) => TRow[];
  /** Total row count across all pages, for a paginator. */
  toTotal?: (response: QueryDataOf<TCreator>) => number;
  /** Whether more pages exist (gates a "load more"/next control). */
  toHasMore?: (response: QueryDataOf<TCreator>) => boolean;
  /** Turns a query failure into the table's error text. Defaults to the first error message. */
  toErrorMessage?: (error: RequestError) => string;
  /** Initial sort. @default [] */
  initialSort?: TableSort[];
  /** Initial filters. @default [] */
  initialFilters?: TableFilter[];
  /** The page `args` receives on first load; `setSort`/`setFilters` reset to it. @default 1 */
  initialPage?: number;
};

const firstErrorMessage = (error: RequestError) => {
  const detail = error.detail;

  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof detail.message === 'string') return detail.message;
    if ('detail' in detail && typeof detail.detail === 'string') return detail.detail;
  }

  if (typeof detail === 'string') return detail;

  return error.statusText || 'Something went wrong';
};

/**
 * The `V2QueryClient` counterpart of {@link tableRowsFromQuery}, for apps still on the legacy
 * client. Returns the same signal bundle - bind it to the table the same way, with
 * `sortMode="server"`. Uses the legacy `queryComputed` container idiom: it re-prepares as sort/page
 * change and releases the previous query.
 *
 * Call it from a field initializer / constructor (injection context).
 */
export const tableRowsFromV2Query = <TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TRow>(
  config: TableRowsFromV2QueryConfig<TCreator, TRow>,
): TableRowsFromQuery<TRow> => {
  type TResponse = QueryDataOf<TCreator>;

  const initialPage = config.initialPage ?? 1;
  const sort = signal<TableSort[]>(config.initialSort ?? []);
  const filters = signal<TableFilter[]>(config.initialFilters ?? []);
  const page = signal(initialPage);

  const query = queryComputed<AnyV2Query | AnyLegacyQuery | null>(() => {
    const args = config.args({ sort, filters, page });

    if (args === null) return null;

    return config.queryCreator.prepare(args).execute() as AnyV2Query | AnyLegacyQuery;
  });

  const state = queryStateSignal(query);
  // Keeps the previous response available while the next request loads (see the select twin).
  const settled = queryStateSignal(query, { cacheResponse: true });
  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  return createTableRowsSource<TResponse, TRow>({
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
    initialPage,
    toRows: config.toRows,
    toTotal: config.toTotal,
    toHasMore: config.toHasMore,
  });
};
