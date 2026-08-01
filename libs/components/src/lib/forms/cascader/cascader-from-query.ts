import { Injector, inject, runInInjectionContext } from '@angular/core';
import {
  AnyQueryCreator,
  QueryArgsOf,
  QueryErrorResponse,
  QueryExecutionState,
  RequestArgs,
  ResponseType,
  withArgs,
} from '@ethlete/query';
import { Observable, defer, filter, finalize, map, switchMap, take, timer } from 'rxjs';
import { CascaderDataSource, CascaderNode } from './headless';

// Note: `@ethlete/components` intentionally depends on `@ethlete/query` (the legacy `cdk` does too),
// so this query-aware convenience factory can live here. It is a standalone function in its own
// module - cascaders that don't use it (and apps not using `@ethlete/query`) tree-shake it away.

/** The optional flat-search half of {@link cascaderFromQuery} - providing it enables the panel's search input. */
export type CascaderFromQuerySearchConfig<TSearchCreator extends AnyQueryCreator, TValue> = {
  /** The query creator behind the flat search (e.g. a backend search endpoint). */
  queryCreator: TSearchCreator;
  /** Builds the request args from the (trimmed) search query. Return `null` to skip the request. */
  args: (query: string) => RequestArgs<QueryArgsOf<TSearchCreator>> | null;
  /** Maps a successful response to the matching paths - root → matching node chains. */
  toResults: (response: ResponseType<QueryArgsOf<TSearchCreator>>) => CascaderNode<TValue>[][];
  /** Minimum query length before requests run. @default 1 */
  minQueryLength?: number;
  /** Debounce before the request fires, in ms. @default 300 */
  debounceTime?: number;
};

/** Config for {@link cascaderFromQuery}. */
export type CascaderFromQueryConfig<
  TCreator extends AnyQueryCreator,
  TValue,
  TSearchCreator extends AnyQueryCreator,
> = {
  /** The query creator that loads one level (e.g. from `createGetQuery`). Must be a query that executes on creation (GET). */
  queryCreator: TCreator;
  /**
   * Builds the request args for loading `parent`'s children (the root level when `parent` is
   * `null`). Return `null` to skip the request - the level shows as empty.
   */
  args: (parent: CascaderNode<TValue> | null) => RequestArgs<QueryArgsOf<TCreator>> | null;
  /** Maps a successful response to the level's nodes. */
  toNodes: (
    response: ResponseType<QueryArgsOf<TCreator>>,
    parent: CascaderNode<TValue> | null,
  ) => CascaderNode<TValue>[];
  /**
   * Turns a query failure into the error text shown in the column (or the search result list).
   * Defaults to the first error message of the response.
   */
  toErrorMessage?: (error: QueryErrorResponse) => string;
  /** Optional flat-search wiring - its presence enables the panel's search input. */
  search?: CascaderFromQuerySearchConfig<TSearchCreator, TValue>;
  /** Passed through to the data source - see `CascaderDataSource.resolvePath`. */
  resolvePath?: CascaderDataSource<TValue>['resolvePath'];
};

const firstErrorMessage = (error: QueryErrorResponse) => {
  const message = 'errors' in error ? error.errors[0]?.message : error.error?.message;

  return message ?? error.raw?.statusText ?? 'Something went wrong';
};

/**
 * Builds a `CascaderDataSource` whose levels (and, optionally, flat search) are fed by
 * `@ethlete/query` queries. Mirroring `createQueryStack`, each level load creates its own query -
 * the cascader loads several levels concurrently (e.g. re-opening onto a committed branch), so one
 * reactive query can't serve them; the client's dedup and caching still coalesce repeated loads.
 * A failed load surfaces as the column's error row (with Retry); the error text comes from
 * `toErrorMessage` and is shown verbatim by `et-cascader`'s default `toErrorMessage`.
 *
 * ```ts
 * competitions = cascaderFromQuery({
 *   queryCreator: getCompetitionChildren,
 *   args: (parent) => ({ queryParams: { parent: parent?.value ?? null } }),
 *   toNodes: (res) => res.items.map((item) => ({ value: item.id, label: item.name, isLeaf: item.isMatch })),
 *   search: {
 *     queryCreator: searchCompetitions,
 *     args: (query) => ({ queryParams: { q: query } }),
 *     toResults: (res) => res.matches.map((match) => match.path.map((p) => ({ value: p.id, label: p.name }))),
 *   },
 * });
 * ```
 *
 * Call it from a field initializer / constructor (injection context), the same place you'd create
 * a query or a query stack.
 */
export const cascaderFromQuery = <
  TCreator extends AnyQueryCreator,
  TValue,
  TSearchCreator extends AnyQueryCreator = TCreator,
>(
  config: CascaderFromQueryConfig<TCreator, TValue, TSearchCreator>,
): CascaderDataSource<TValue> => {
  const injector = inject(Injector);
  const toErrorMessage = config.toErrorMessage ?? firstErrorMessage;

  // one query per load, the query-stack pattern: created with static args (auto-executes), read
  // until the execution settles, then destroyed. Unsubscribing early (a collapsed column, a newer
  // search) destroys it mid-flight.
  const runQuery = <TRunCreator extends AnyQueryCreator, TResult>(options: {
    creator: TRunCreator;
    requestArgs: RequestArgs<QueryArgsOf<TRunCreator>>;
    toResult: (response: ResponseType<QueryArgsOf<TRunCreator>>) => TResult;
  }): Observable<TResult> =>
    defer(() => {
      const { creator, requestArgs, toResult } = options;
      const query = runInInjectionContext(injector, () =>
        creator(withArgs<QueryArgsOf<TRunCreator>>(() => requestArgs)),
      );

      const state$ = query.executionState.asObservable() as Observable<QueryExecutionState<
        QueryArgsOf<TRunCreator>
      > | null>;

      return state$.pipe(
        filter(
          (state): state is Exclude<QueryExecutionState<QueryArgsOf<TRunCreator>>, { type: 'loading' }> =>
            state !== null && state.type !== 'loading',
        ),
        take(1),
        map((state) => {
          if (state.type === 'failure') {
            // Deliberately a plain `Error`, not a coded `RuntimeError`: this message is the
            // display-ready text for the column's error row (the cascader's default
            // `toErrorMessage` shows `error.message` verbatim), so a `ET33xx: ` prefix would end up
            // in front of the user.
            throw new Error(toErrorMessage(state.error));
          }

          return toResult(state.response);
        }),
        finalize(() => query.subtle.destroy()),
      );
    });

  const searchConfig = config.search;

  const source: CascaderDataSource<TValue> = {
    loadChildren: (parent) => {
      const requestArgs = config.args(parent);

      if (requestArgs === null) {
        return [];
      }

      return runQuery({
        creator: config.queryCreator,
        requestArgs,
        toResult: (response) => config.toNodes(response, parent),
      });
    },
  };

  if (config.resolvePath) {
    source.resolvePath = config.resolvePath;
  }

  if (searchConfig) {
    source.search = (query) => {
      const trimmed = query.trim();

      if (trimmed.length < (searchConfig.minQueryLength ?? 1)) {
        return [];
      }

      const requestArgs = searchConfig.args(trimmed);

      if (requestArgs === null) {
        return [];
      }

      // the timer is the debounce: the cascader switchMaps search calls, so a newer keystroke
      // unsubscribes this one before its request ever fires
      return timer(searchConfig.debounceTime ?? 300).pipe(
        switchMap(() =>
          runQuery({ creator: searchConfig.queryCreator, requestArgs, toResult: searchConfig.toResults }),
        ),
      );
    };
  }

  return source;
};
