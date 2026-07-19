import { Signal, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
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
import { debounceTime as rxDebounceTime } from 'rxjs';
import { SelectOptionsFromQuery } from './select-options-from-query';

// The legacy twin of `select-options-from-query.ts` for apps still on the class-based
// `V2QueryClient`. Same module rules apply: standalone function in its own file so unused
// integrations tree-shake away.

/** The args accepted by the creator's `prepare()` — includes `mock`/`config` extras. */
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
   * Builds the `prepare()` args from the debounced search query. Runs reactively (like
   * `queryComputed`): reading `query()` re-executes as the user types. Return `null` to skip a
   * request (e.g. for an empty query) — `options` is empty while skipped.
   */
  args: (query: Signal<string>) => V2PrepareArgsOf<TCreator> | null;
  /** Maps a successful response to the option data your `@for` renders. */
  toOptions: (response: QueryDataOf<TCreator>) => TOption[];
  /** Derives whether more pages exist from the response — drives the select's `hasMoreItems`. */
  toHasMore?: (response: QueryDataOf<TCreator>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message. */
  toErrorMessage?: (error: RequestError) => string;
  /** Minimum query length before requests run. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to the query before it reaches `args`, in ms. @default 300 */
  debounceTime?: number;
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

  return error.statusText || 'Something went wrong';
};

/**
 * Feeds a select's options from a **legacy v2** query as the user searches — the
 * `V2QueryClient` counterpart of {@link selectOptionsFromQuery}, so apps that haven't migrated
 * yet can still adopt the new async select. It returns the same signal bundle; wire it to the
 * select's async inputs and render `options` yourself with `filterMode="external"`:
 *
 * ```ts
 * users = selectOptionsFromV2Query({
 *   queryCreator: searchUsers, // client.get({ route: '/users', types: { … } })
 *   args: (query) => (query() ? { queryParams: { q: query() } } : null),
 *   toOptions: (res) => res.items,
 * });
 * ```
 *
 * ```html
 * <et-select
 *   [formField]="form.assignee"
 *   [loading]="users.loading()"
 *   [error]="users.error()"
 *   (queryChange)="users.setQuery($event)"
 *   filterMode="external"
 * >
 *   <input etSelectSearch placeholder="Search users" />
 *   @for (user of users.options(); track user.id) {
 *     <et-select-option [value]="user.id">{{ user.name }}</et-select-option>
 *   }
 * </et-select>
 * ```
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd use
 * `queryComputed` or a query container.
 */
export const selectOptionsFromV2Query = <TCreator extends AnyV2QueryCreator | AnyLegacyQueryCreator, TOption>(
  config: SelectOptionsFromV2QueryConfig<TCreator, TOption>,
): SelectOptionsFromQuery<TOption> => {
  const rawQuery = signal('');
  const debouncedQuery = toSignal(toObservable(rawQuery).pipe(rxDebounceTime(config.debounceTime ?? 300)), {
    initialValue: '',
  });

  const minQueryLength = config.minQueryLength ?? 0;
  const skipped = computed(() => debouncedQuery().trim().length < minQueryLength);

  // `queryComputed` is the legacy container idiom: it re-prepares as the debounced query changes
  // and aborts/releases the previous query instance (and the current one on destroy).
  const query = queryComputed<AnyV2Query | AnyLegacyQuery | null>(() => {
    if (skipped()) {
      return null;
    }

    const args = config.args(debouncedQuery);

    if (args === null) {
      return null;
    }

    return config.queryCreator.prepare(args).execute() as AnyV2Query | AnyLegacyQuery;
  });

  const state = queryStateSignal(query);
  // Success/failure only — keeps the previous options rendered while the next request loads,
  // mirroring how the current system's `response()` behaves across re-executions.
  const settledState = queryStateSignal(query, { cacheResponse: true });

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  const options = computed(() => {
    const settled = settledState();

    if (skipped() || !isQueryStateSuccess(settled)) {
      return [];
    }

    return config.toOptions(settled.response as QueryDataOf<TCreator>);
  });

  const hasMore = computed(() => {
    const toHasMore = config.toHasMore;
    const settled = settledState();

    if (!toHasMore || skipped() || !isQueryStateSuccess(settled)) {
      return false;
    }

    return toHasMore(settled.response as QueryDataOf<TCreator>);
  });

  return {
    options,
    loading: computed(() => isQueryStateLoading(state())),
    error: computed(() => {
      const current = state();

      return isQueryStateFailure(current) && !skipped() ? toErrorMessage(current.error) : null;
    }),
    hasMore,
    query: debouncedQuery,
    setQuery: (value: string) => rawQuery.set(value),
  };
};
