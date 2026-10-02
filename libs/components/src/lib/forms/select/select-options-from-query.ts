import { Signal, computed, signal } from '@angular/core';
import {
  AnyQueryCreator,
  QueryArgsOf,
  QueryErrorResponse,
  RequestArgs,
  ResponseType,
  createPagedQueryStack,
} from '@ethlete/query';
import { NormalizedPagination } from '@ethlete/types';
import { injectSelectLabels } from './select-labels';
import { createSelectOptionsSearch, endsPagination } from './select-options-paging';

/** Config for {@link selectOptionsFromQuery}. */
export type SelectOptionsFromQueryConfig<TCreator extends AnyQueryCreator, TOption> = {
  /**
   * The query creator to run (e.g. from `createGetQuery`). Its pages run on a paged query stack that
   * restarts when the debounced search query changes - never per keystroke.
   */
  queryCreator: TCreator;
  /**
   * Builds the request args from the debounced search query and the current `page`. Return `null`
   * to skip a request (e.g. for an empty query) - `options` is empty while skipped.
   */
  args: (query: Signal<string>, page: Signal<number>) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /**
   * Maps a successful response to the option slice for the **current page**. The factory appends
   * each page's slice to the accumulated `options` (and resets when the query changes).
   */
  toOptions: (response: ResponseType<QueryArgsOf<TCreator>>) => TOption[];
  /** Derives whether more pages exist from the latest page's response - drives `hasMoreItems` and gates `loadMore()`. */
  toHasMore?: (response: ResponseType<QueryArgsOf<TCreator>>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message, else `SELECT_LABELS.error`. */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Minimum query length before requests run. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to the query before it reaches `args`, in ms. @default 300 */
  debounceTime?: number;
  /** The page `args` receives on first load and after each query change. @default 1 */
  initialPage?: number;
};

export type SelectOptionsFromQuery<TOption> = {
  /** The mapped options - render them with an `@for` of `et-select-option`s (`filterMode="external"`). */
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
   * Wire to the select's `(loadMore)` output - advances to the next page and appends it
   * to `options`. A no-op while loading, when skipped, or once `hasMore` is false.
   */
  loadMore: () => void;
};

const firstErrorMessage = (error: QueryErrorResponse) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText;
};

/**
 * Feeds a select's options from an `@ethlete/query` query as the user searches. It takes the
 * `queryCreator` plus a reactive `args` builder and runs them on a `createPagedQueryStack`: the stack
 * restarts at `initialPage` as the (debounced) search query changes. Bind the returned bundle with
 * `[etSelectOptions]` - it wires the async state and the query/load-more plumbing - and render
 * `options` yourself:
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
 * Call it from a field initializer / constructor (injection context), the same place you'd create
 * a query or a query stack.
 */
export const selectOptionsFromQuery = <TCreator extends AnyQueryCreator, TOption>(
  config: SelectOptionsFromQueryConfig<TCreator, TOption>,
): SelectOptionsFromQuery<TOption> => {
  type TArgs = QueryArgsOf<TCreator>;
  type TResponse = NonNullable<ResponseType<TArgs>>;

  const labels = injectSelectLabels();
  const search = createSelectOptionsSearch(config);
  const initialPage = config.initialPage ?? 1;
  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  // the page number is the response's position in the stack, so it is only valid for settled pages
  const toPagination = (response: TResponse, responses: TResponse[]): NormalizedPagination<TOption> => {
    const index = responses.indexOf(response);
    const currentPage = initialPage + index;
    const slice = config.toOptions(response);
    const previous = responses[index - 1];
    const ended = endsPagination(slice, previous === undefined ? undefined : config.toOptions(previous));
    const totalPages = !ended && config.toHasMore?.(response) ? currentPage + 1 : currentPage;

    return {
      items: ended ? [] : slice,
      currentPage,
      totalPages,
      itemsPerPage: slice.length,
      totalHits: 0,
    };
  };

  const stack = createPagedQueryStack({
    queryCreator: config.queryCreator.clone({ reportErrors: false }),
    responseNormalizer: toPagination,
    args: (page) => (search.skipped() ? null : config.args(search.query, signal(page).asReadonly())),
    initialPage,
  });

  const latestPagination = computed(() => {
    const responses = stack
      .queries()
      .map((query) => query.response())
      .filter((response): response is TResponse => response !== null);
    const latest = responses.at(-1);

    return latest === undefined ? null : toPagination(latest, responses);
  });

  const hasMore = computed(() => {
    const pagination = latestPagination();

    return !search.skipped() && pagination !== null && pagination.currentPage < pagination.totalPages;
  });

  return {
    options: computed(() => (search.skipped() ? [] : stack.items())),
    loading: stack.loading,
    error: computed(() => {
      const error = stack.error();

      if (error === null || search.skipped()) {
        return null;
      }

      return toErrorMessage(error) ?? labels().error;
    }),
    hasMore,
    query: search.query,
    setQuery: search.setQuery,
    loadMore: () => {
      if (search.skipped() || !hasMore() || !stack.canFetchNextPage()) {
        return;
      }

      stack.fetchNextPage();
    },
  };
};
