import { Signal, computed, effect, linkedSignal, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AnyQueryCreator, QueryArgsOf, QueryErrorResponse, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { debounceTime as rxDebounceTime } from 'rxjs';
import { PageState, endsPagination } from './select-options-paging';

// Note: `@ethlete/components` intentionally depends on `@ethlete/query` (the legacy `cdk` does too),
// so this query-aware convenience factory can live here. It is a standalone function in its own
// module — selects that don't use it (and apps not using `@ethlete/query`) tree-shake it away.

/** Config for {@link selectOptionsFromQuery}. */
export type SelectOptionsFromQueryConfig<TCreator extends AnyQueryCreator, TOption> = {
  /**
   * The query creator to run (e.g. from `createGetQuery`). Like a query stack, the query is created
   * **once** and re-executes reactively — never per keystroke.
   */
  queryCreator: TCreator;
  /**
   * Builds the request args from the debounced search query and the current `page`. Runs
   * reactively (like `withArgs`): reading `query()` re-executes as the user types, and reading
   * `page()` re-executes when `loadMore()` advances the page. Return `null` to skip a request
   * (e.g. for an empty query) — `options` is empty while skipped.
   *
   * `page` starts at `initialPage` and resets there whenever the query changes; `loadMore()`
   * increments it. Return only that page's slice from `toOptions` — the factory appends each
   * page to the accumulated `options`.
   */
  args: (query: Signal<string>, page: Signal<number>) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /**
   * Maps a successful response to the option slice for the **current page**. The factory appends
   * each page's slice to the accumulated `options` (and resets when the query changes).
   */
  toOptions: (response: ResponseType<QueryArgsOf<TCreator>>) => TOption[];
  /** Derives whether more pages exist from the latest page's response — drives `hasMoreItems` and gates `loadMore()`. */
  toHasMore?: (response: ResponseType<QueryArgsOf<TCreator>>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message. */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Minimum query length before requests run. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to the query before it reaches `args`, in ms. @default 300 */
  debounceTime?: number;
  /** The page `args` receives on first load and after each query change. @default 1 */
  initialPage?: number;
};

export type SelectOptionsFromQuery<TOption> = {
  /** The mapped options — render them with an `@for` of `et-select-option`s (`filterMode="external"`). */
  options: Signal<TOption[]>;
  /** Bind to the select's `loading` input. */
  loading: Signal<boolean>;
  /** Bind to the select's `error` input. */
  error: Signal<string | null>;
  /** Bind to the select's `hasMoreItems` input (always false without `toHasMore`). */
  hasMore: Signal<boolean>;
  /** The debounced query currently driving the request. */
  query: Signal<string>;
  /** Wire to the select's `(queryChange)` output. */
  setQuery: (query: string) => void;
  /**
   * Wire to the select's `(loadMore)` output — advances to the next page and appends it
   * to `options`. A no-op while loading, when skipped, or once `hasMore` is false.
   */
  loadMore: () => void;
};

const firstErrorMessage = (error: QueryErrorResponse) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText ?? 'Something went wrong';
};

/**
 * Feeds a select's options from an `@ethlete/query` query as the user searches. Mirroring
 * `createQueryStack`, it takes the `queryCreator` plus a reactive `args` builder: the query is
 * created once and re-executes as the (debounced) search query changes. Wire the returned signals
 * to the select's async inputs and render `options` yourself with `filterMode="external"`:
 *
 * ```ts
 * users = selectOptionsFromQuery({
 *   queryCreator: searchUsers,
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
 * Pagination is built in: `loadMore()` advances `page` and appends the next page's slice to
 * `options`; the accumulator resets whenever the query changes. Derive `hasMore` from the latest
 * response via `toHasMore` — it also gates `loadMore()`.
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd create
 * a query or a query stack.
 *
 * Pagination is built in: `args` receives a `page` signal (starting at `initialPage`, default `1`)
 * that resets on every query change and advances on `loadMore()`. Return only the current page's
 * slice from `toOptions` — the factory appends each page to the accumulated `options`. Wire
 * `hasMore` (via `toHasMore`) to `hasMoreItems` and `loadMore` to `(loadMore)`; `loadMore`
 * is a no-op while loading, when skipped, or once `hasMore` is false.
 */
export const selectOptionsFromQuery = <TCreator extends AnyQueryCreator, TOption>(
  config: SelectOptionsFromQueryConfig<TCreator, TOption>,
): SelectOptionsFromQuery<TOption> => {
  type TArgs = QueryArgsOf<TCreator>;

  const rawQuery = signal('');
  const debouncedQuery = toSignal(toObservable(rawQuery).pipe(rxDebounceTime(config.debounceTime ?? 300)), {
    initialValue: '',
  });

  const minQueryLength = config.minQueryLength ?? 0;
  const skipped = computed(() => debouncedQuery().trim().length < minQueryLength);

  const initialPage = config.initialPage ?? 1;
  // Resets to `initialPage` whenever the debounced query changes (so the next request starts a
  // fresh page run), and `loadMore()` bumps it. Keyed off the debounced query — not the raw one —
  // so the reset lands in the same tick the request re-runs, never firing a spurious page.
  const page = linkedSignal<string, number>({
    source: debouncedQuery,
    computation: () => initialPage,
  });

  // created once, exactly like a query stack — `withArgs` re-runs as the debounced query or page changes
  const query = config.queryCreator(
    withArgs<TArgs>(() => {
      if (skipped()) {
        return null;
      }

      return config.args(debouncedQuery, page);
    }),
  );

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  // Accumulate the per-page slices, indexed by page offset. `query.response()` only holds the
  // latest page, so this folds each new response into the slice for the page it was requested for
  // (`page` read untracked: only a new response, never an in-flight page bump, appends). Slicing to
  // `index` drops later pages, so a query change (page back to `initialPage`) resets to one page.
  // It's a `linkedSignal` (not a plain accumulator) so `options` recomputes synchronously on read.
  //
  // `ended` is the fold's own verdict on whether the list is exhausted, and it overrules `toHasMore`:
  // see `endsPagination`.
  const pageState = linkedSignal<ResponseType<TArgs> | null, PageState<TOption>>({
    source: () => query.response(),
    computation: (response, previous) => {
      const index = untracked(page) - initialPage;
      const slices = (previous?.value?.slices ?? []).slice(0, index);

      if (response === null) {
        // A page is in flight: keep what is accumulated, and keep `ended` unless this is a fresh run.
        return { slices, ended: index === 0 ? false : (previous?.value?.ended ?? false) };
      }

      const nextSlice = config.toOptions(response);
      const ended = endsPagination(nextSlice, slices[index - 1]);

      if (!ended) {
        slices[index] = nextSlice;
      }

      return { slices, ended };
    },
  });

  // A `linkedSignal` only folds while something observes it — so a page that settles while nothing
  // renders `options` (e.g. the panel is closed) would be skipped, and a later page would fold over
  // a stale `previous`. This keepalive makes the fold eager: it captures every settled page.
  effect(() => void pageState());

  const options = computed(() => (skipped() ? [] : pageState().slices.flat()));

  const hasMore = computed(() => {
    const toHasMore = config.toHasMore;

    if (!toHasMore || skipped() || pageState().ended) {
      return false;
    }

    const response = query.response();

    return response === null ? false : toHasMore(response);
  });

  return {
    options,
    loading: computed(() => query.loading() !== null),
    error: computed(() => {
      const error = query.error();

      return error === null || skipped() ? null : toErrorMessage(error);
    }),
    hasMore,
    query: debouncedQuery,
    setQuery: (value: string) => rawQuery.set(value),
    loadMore: () => {
      if (skipped() || query.loading() !== null || !hasMore()) {
        return;
      }

      page.update((current) => current + 1);
    },
  };
};
