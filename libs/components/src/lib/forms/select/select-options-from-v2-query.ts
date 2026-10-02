import { Signal, computed } from '@angular/core';
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
import { SelectOptionsFromQuery } from './select-options-from-query';
import { createSelectOptionsPaging } from './select-options-paging';

/** The args accepted by the creator's `prepare()` - includes `mock`/`config` extras. */
export type V2PrepareArgsOf<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator> = Parameters<
  TCreator['prepare']
>[0];

/** Config for {@link selectOptionsFromV2Query}. */
export type SelectOptionsFromV2QueryConfig<TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TOption> = {
  /**
   * The legacy query creator to run (from `V2QueryClient`'s `get`/`gqlQuery`, or a
   * `createLegacyQueryCreator` interop wrapper). A fresh query is prepared and executed whenever
   * the debounced search query changes; the previous one is released like in a query container.
   */
  queryCreator: TCreator;
  /**
   * Builds the `prepare()` args from the debounced search query and the current `page`. Return
   * `null` to skip a request (e.g. for an empty query) - `options` is empty while skipped.
   */
  args: (query: Signal<string>, page: Signal<number>) => V2PrepareArgsOf<TCreator> | null;
  /**
   * Maps a successful response to the option slice for the **current page**. The factory appends
   * each page's slice to the accumulated `options` (and resets when the query changes).
   */
  toOptions: (response: QueryDataOf<TCreator>) => TOption[];
  /** Derives whether more pages exist from the latest page's response - drives `hasMoreItems` and gates `loadMore()`. */
  toHasMore?: (response: QueryDataOf<TCreator>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message, else `SELECT_LABELS.error`. */
  toErrorMessage?: (error: RequestError) => string;
  /** Minimum query length before requests run. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to the query before it reaches `args`, in ms. @default 300 */
  debounceTime?: number;
  /** The page `args` receives on first load and after each query change. @default 1 */
  initialPage?: number;
};

const firstErrorMessage = (error: RequestError) => {
  const detail = error.detail;

  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof detail.message === 'string') {
      return detail.message;
    }

    if ('detail' in detail && typeof detail.detail === 'string') {
      return detail.detail;
    }
  }

  if (typeof detail === 'string') {
    return detail;
  }

  return error.statusText || undefined;
};

/**
 * Feeds a select's options from a **legacy v2** query as the user searches - the
 * `V2QueryClient` counterpart of {@link selectOptionsFromQuery}, so apps that haven't migrated
 * yet can still adopt the new async select. It returns the same signal bundle; bind it with
 * `[etSelectOptions]` and render `options` yourself:
 *
 * ```ts
 * users = selectOptionsFromV2Query({
 *   queryCreator: searchUsers, // client.get({ route: '/users', types: { … } })
 *   args: (query, page) => (query() ? { queryParams: { q: query(), page: page() } } : null),
 *   toOptions: (res) => res.items,
 *   toHasMore: (res) => res.page < res.totalPages,
 * });
 * ```
 *
 * ```html
 * <et-select [formField]="form.assignee" [etSelectOptions]="users">
 *   <input etSelectSearch placeholder="Search users" />
 *   @for (user of users.options(); track user.id) {
 *     <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
 *   }
 * </et-select>
 * ```
 *
 * To intercept a single binding, wire `loading`, `error`, `hasMoreItems`, `queryChange`, `loadMore` and
 * `filterMode="external"` by hand instead - see the select guide's async options section.
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd use
 * `queryComputed` or a query container.
 */
export const selectOptionsFromV2Query = <TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TOption>(
  config: SelectOptionsFromV2QueryConfig<TCreator, TOption>,
): SelectOptionsFromQuery<TOption> => {
  const paging = createSelectOptionsPaging(config);

  const query = queryComputed<AnyV2Query | AnyLegacyQuery | null>(() => {
    const args = paging.skipped() ? null : config.args(paging.query, paging.page);

    return args === null ? null : (config.queryCreator.prepare(args).execute() as AnyV2Query | AnyLegacyQuery);
  });

  const state = queryStateSignal(query);
  const settledState = queryStateSignal(query, { cacheResponse: true });

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  return paging.connect({
    settled: settledState,
    toSlice: (settled) =>
      isQueryStateSuccess(settled) ? config.toOptions(settled.response as QueryDataOf<TCreator>) : null,
    hasMore: (settled) =>
      isQueryStateSuccess(settled) && !!config.toHasMore?.(settled.response as QueryDataOf<TCreator>),
    loading: computed(() => isQueryStateLoading(state())),
    error: computed(() => {
      const current = state();

      return isQueryStateFailure(current) ? toErrorMessage(current.error) : null;
    }),
  });
};
