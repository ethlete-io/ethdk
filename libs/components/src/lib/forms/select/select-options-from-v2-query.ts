import { Signal, computed, effect, linkedSignal, signal, untracked } from '@angular/core';
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
   * Builds the `prepare()` args from the debounced search query and the current `page`. Runs
   * reactively (like `queryComputed`): reading `query()` re-executes as the user types, and reading
   * `page()` re-executes when `loadMore()` advances the page. Return `null` to skip a request
   * (e.g. for an empty query) — `options` is empty while skipped.
   *
   * `page` starts at `initialPage` and resets there whenever the query changes; `loadMore()`
   * increments it. Return only that page's slice from `toOptions` — the factory appends each
   * page to the accumulated `options`.
   */
  args: (query: Signal<string>, page: Signal<number>) => V2PrepareArgsOf<TCreator> | null;
  /**
   * Maps a successful response to the option slice for the **current page**. The factory appends
   * each page's slice to the accumulated `options` (and resets when the query changes).
   */
  toOptions: (response: QueryDataOf<TCreator>) => TOption[];
  /** Derives whether more pages exist from the latest page's response — drives `hasMoreItems` and gates `loadMore()`. */
  toHasMore?: (response: QueryDataOf<TCreator>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message. */
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
 *   args: (query, page) => (query() ? { queryParams: { q: query(), page: page() } } : null),
 *   toOptions: (res) => res.items,
 *   toHasMore: (res) => res.page < res.totalPages,
 * });
 * ```
 *
 * ```html
 * <et-select
 *   [formField]="form.assignee"
 *   [loading]="users.loading()"
 *   [error]="users.error()"
 *   [hasMoreItems]="users.hasMore()"
 *   (queryChange)="users.setQuery($event)"
 *   (loadMore)="users.loadMore()"
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
 *
 * Pagination is built in: `args` receives a `page` signal (starting at `initialPage`, default `1`)
 * that resets on every query change and advances on `loadMore()`. Return only the current page's
 * slice from `toOptions` — the factory appends each page to the accumulated `options`. Wire
 * `hasMore` (via `toHasMore`) to `hasMoreItems` and `loadMore` to `(loadMore)`; `loadMore`
 * is a no-op while loading, when skipped, or once `hasMore` is false.
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

  const initialPage = config.initialPage ?? 1;
  // Resets to `initialPage` whenever the debounced query changes (so the next request starts a
  // fresh page run), and `loadMore()` bumps it. Keyed off the debounced query — not the raw one —
  // so the reset lands in the same tick the query re-prepares, never firing a spurious page.
  const page = linkedSignal<string, number>({
    source: debouncedQuery,
    computation: () => initialPage,
  });

  // `queryComputed` is the legacy container idiom: it re-prepares as the debounced query or page
  // changes and aborts/releases the previous query instance (and the current one on destroy).
  const query = queryComputed<AnyV2Query | AnyLegacyQuery | null>(() => {
    if (skipped()) {
      return null;
    }

    const args = config.args(debouncedQuery, page);

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

  // Accumulate the per-page slices, indexed by page offset. `settledState` only holds the latest
  // settled response, so this folds each new success into the slice for the page it was requested
  // for (`page` read untracked: only a new settled state, never an in-flight page bump, appends).
  // Slicing to `index` drops later pages, so a query change (page back to `initialPage`) resets to
  // one page; a non-success settled state keeps the accumulated slices as-is. It's a `linkedSignal`
  // (not a plain accumulator) so `options` recomputes synchronously on read.
  const pageSlices = linkedSignal<ReturnType<typeof settledState>, TOption[][]>({
    source: settledState,
    computation: (settled, previous) => {
      const index = untracked(page) - initialPage;
      const slices = (previous?.value ?? []).slice(0, index);

      if (isQueryStateSuccess(settled)) {
        slices[index] = config.toOptions(settled.response as QueryDataOf<TCreator>);
      }

      return slices;
    },
  });

  // A `linkedSignal` only folds while something observes it — so a page that settles while nothing
  // renders `options` (e.g. the panel is closed) would be skipped, and a later page would fold over
  // a stale `previous`. This keepalive makes the fold eager: it captures every settled page.
  effect(() => void pageSlices());

  const options = computed(() => (skipped() ? [] : pageSlices().flat()));

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
    loadMore: () => {
      if (skipped() || isQueryStateLoading(state()) || !hasMore()) {
        return;
      }

      page.update((current) => current + 1);
    },
  };
};
