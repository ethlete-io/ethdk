import { Signal, computed } from '@angular/core';
import { AnyQueryCreator, QueryArgsOf, QueryErrorResponse, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { createSelectOptionsPaging } from './select-options-paging';

/** Config for {@link selectOptionsFromQuery}. */
export type SelectOptionsFromQueryConfig<TCreator extends AnyQueryCreator, TOption> = {
  /**
   * The query creator to run (e.g. from `createGetQuery`). Like a query stack, the query is created
   * **once** and re-executes reactively - never per keystroke.
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
 * Call it from a field initializer / constructor (injection context), the same place you'd create
 * a query or a query stack.
 */
export const selectOptionsFromQuery = <TCreator extends AnyQueryCreator, TOption>(
  config: SelectOptionsFromQueryConfig<TCreator, TOption>,
): SelectOptionsFromQuery<TOption> => {
  type TArgs = QueryArgsOf<TCreator>;

  const paging = createSelectOptionsPaging(config);

  const query = config.queryCreator.clone({ reportErrors: false })(
    withArgs<TArgs>(() => (paging.skipped() ? null : config.args(paging.query, paging.page))),
  );

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  return paging.connect({
    settled: query.response,
    toSlice: (response: ResponseType<TArgs> | null) => (response === null ? null : config.toOptions(response)),
    hasMore: (response) => response !== null && !!config.toHasMore?.(response),
    loading: computed(() => query.loading() !== null),
    error: computed(() => {
      const error = query.error();

      return error === null ? null : toErrorMessage(error);
    }),
  });
};
