import { Signal, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AnyQueryCreator, QueryArgsOf, QueryErrorResponse, RequestArgs, ResponseType, withArgs } from '@ethlete/query';
import { debounceTime as rxDebounceTime } from 'rxjs';

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
   * Builds the request args from the debounced search query. Runs reactively (like `withArgs`):
   * reading `query()` re-executes as the user types. Return `null` to skip a request (e.g. for an
   * empty query) — `options` is empty while skipped.
   */
  args: (query: Signal<string>) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /** Maps a successful response to the option data your `@for` renders. */
  toOptions: (response: ResponseType<QueryArgsOf<TCreator>>) => TOption[];
  /** Derives whether more pages exist from the response — drives the select's `hasMoreItems`. */
  toHasMore?: (response: ResponseType<QueryArgsOf<TCreator>>) => boolean;
  /** Turns a query failure into the select's error text. Defaults to the first error message. */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Minimum query length before requests run. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to the query before it reaches `args`, in ms. @default 300 */
  debounceTime?: number;
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
 * Call it from a field initializer / constructor (injection context), the same place you'd create
 * a query or a query stack.
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

  // created once, exactly like a query stack — `withArgs` re-runs as the debounced query changes
  const query = config.queryCreator(
    withArgs<TArgs>(() => {
      if (skipped()) {
        return null;
      }

      return config.args(debouncedQuery);
    }),
  );

  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  const options = computed(() => {
    if (skipped()) {
      return [];
    }

    const response = query.response();

    return response === null ? [] : config.toOptions(response);
  });

  const hasMore = computed(() => {
    const toHasMore = config.toHasMore;

    if (!toHasMore || skipped()) {
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
  };
};
