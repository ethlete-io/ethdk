/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, effect, inject, Injector, runInInjectionContext, Signal, signal, untracked } from '@angular/core';
import { AnyNewQuery, RequestArgs, ResponseType } from './query';
import { AnyQueryCreator, QueryArgsOf, RunQueryCreator } from './query-creator';
import { QueryErrorResponse } from './query-error-response';
import { queryStackWithArgsUsed, queryStackWithResponseUpdateUsed } from './query-errors';
import { QueryFeature, QueryFeatureType, withArgs } from './query-features';

export type QueryStackSubtle<TCreator extends AnyQueryCreator, TQuery extends AnyNewQuery> = {
  /** Create a new query with the given arguments. You should always prefer the `args` option instead of this. */
  runWithArgs: (
    args: RequestArgs<QueryArgsOf<TCreator>> | RequestArgs<QueryArgsOf<TCreator>>[] | null,
  ) => TQuery | null;
};

export type QueryStack<TQuery extends AnyNewQuery, TCreator extends AnyQueryCreator, TTransform> = {
  /** Contains all queries in the stack. */
  queries: Signal<TQuery[]>;

  /** Contains the first query in the stack. */
  firstQuery: Signal<TQuery | null>;

  /** Contains the last query in the stack. Useful for getting current pagination values. */
  lastQuery: Signal<TQuery | null>;

  /** True if any query in the stack is loading. */
  loading: Signal<boolean>;

  /** Contains the first error that occurred in the stack. */
  error: Signal<QueryErrorResponse | null>;

  /** Contains the responses of all queries in the stack. Will be `null` for queries that are loading or errored. */
  response: Signal<TTransform>;

  /** Executes all queries in the stack. */
  execute: (options?: { allowCache?: boolean }) => void;

  /** Destroys all queries in the stack and empties it. This should only be used if `append` is true. */
  clear: () => void;

  /** Advanced query stack features. **WARNING!** Incorrectly using these features will likely **BREAK** your application. You have been warned! */
  subtle: QueryStackSubtle<TCreator, TQuery>;
};

export type AnyQueryStack = QueryStack<AnyNewQuery, AnyQueryCreator, any>;

export type CreateQueryStackOptions<
  TCreator extends AnyQueryCreator,
  TDeps extends () => any,
  TTransform = (ResponseType<QueryArgsOf<TCreator>> | null)[],
> = {
  /**
   * The query creator function that will be used to create the query stack.
   */
  queryCreator: TCreator;

  /**
   * The dependencies that should trigger a new query stack creation.
   * This function can be treated like a computed function. It reacts to signal changes.
   * The return value of this function will be passed to the `args` function.
   *
   * This option can be ignored if `append` is false.
   */
  dependencies?: TDeps;

  /**
   * The features that should be used for all queries in the stack.
   *
   * @throws If the `withArgs` feature is used. This feature is internally used.
   *
   * @example
   * // Due to limitations in TypeScript, you have to manually add the needed generic types if needed.
   * features: [E.withSuccessHandling<GetPostQueryArgs>({ handler: (post) => console.log(post.title) })]
   *
   * @example
   * // If typings are not needed, you can use the feature without generics.
   * features: [E.withPolling({ interval: 5000 })]
   */
  features?: QueryFeature<any>[];

  /**
   * The arguments to create queries with.
   * This function can be treated like a computed function. It reacts to signal changes.
   * If a signal changes, a new query will be created (and appended to the existing ones if `append` is true).
   * If this function returns `null`, the args will be ignored.
   * If this function returns an array, multiple queries will be created.
   *
   * @example
   * // One query
   * () => ({ queryParams: { postId: myId() } }),
   *
   * @example
   * // Multiple queries (these can of cause also be created using a loop)
   * () => [
   *  { queryParams: { postId: myId() } },
   *  { queryParams: { postId: myOtherId() } },
   * ],
   *
   * @example
   * // One query with dependencies
   * (deps) => ({ queryParams: { postId: myId(), limit: deps.limit } }),
   */
  args: (deps: ReturnType<TDeps>) => RequestArgs<QueryArgsOf<TCreator>> | RequestArgs<QueryArgsOf<TCreator>>[] | null;

  /**
   * If true, new queries will be appended to the existing ones. Otherwise, existing queries will be destroyed.
   * This should be used for things like infinite scrolling where already fetched queries should not be destroyed.
   */
  append?: boolean;

  /**
   * If append is true, this function will be called to merge the old and new queries.
   * Useful if you want to append the new queries in a specific order (e.g. at the beginning).
   */
  appendFn?: (
    oldQueries: RunQueryCreator<TCreator>[],
    newQueries: RunQueryCreator<TCreator>[],
  ) => {
    /** The new queries merged with the old ones. */
    queries: RunQueryCreator<TCreator>[];

    /** The last query in the new queries. */
    lastQuery: RunQueryCreator<TCreator> | null;
  };

  /**
   * Transforms the responses of all queries in the stack. Useful for merging or filtering responses.
   */
  transform?: (responses: ResponseType<QueryArgsOf<TCreator>>[]) => TTransform;
};

/** Transforms an array of arrays into a single array and filters out `null` values. */
export const transformArrayResponse = <T extends (unknown | null)[]>(responses: T) =>
  responses.filter((r) => !!r).flatMap((r) => r) as NonNullable<T[0]>[];

/** Transforms an array of paginated responses into a single array and filters out `null` values. */
export const transformPaginatedResponse = <T extends ({ items: unknown[] } | null)[]>(responses: T) =>
  responses.filter((r) => !!r).flatMap((r) => r.items) as NonNullable<NonNullable<T[0]>['items']>;

export const createQueryStack = <
  TCreator extends AnyQueryCreator,
  TArgs extends QueryArgsOf<TCreator>,
  TDeps extends () => any,
  TTransform = (ResponseType<TArgs> | null)[],
>(
  options: CreateQueryStackOptions<TCreator, TDeps, TTransform>,
) => {
  type QueryType = RunQueryCreator<TCreator>;

  const {
    args,
    queryCreator,
    dependencies,
    append,
    features = [],
    appendFn = (oldQueries: QueryType[], newQueries: QueryType[]) => {
      const queries = [...oldQueries, ...newQueries];
      const lastQuery = newQueries[newQueries.length - 1] ?? oldQueries[oldQueries.length - 1] ?? null;

      return { queries, lastQuery };
    },
    transform,
  } = options ?? {};

  const injector = inject(Injector);

  const queries = signal<QueryType[]>([]);
  const lastQuery = signal<QueryType | null>(null);
  const firstQuery = computed(() => queries()[0] ?? null);

  const hasWithArgsFeature = features.some((f) => f.type == QueryFeatureType.WithArgs);
  const hasWithOptimisticUpdateFeature = features.some((f) => f.type == QueryFeatureType.WithResponseUpdate);

  if (hasWithArgsFeature) {
    throw queryStackWithArgsUsed();
  }

  if (hasWithOptimisticUpdateFeature) {
    throw queryStackWithResponseUpdateUsed();
  }

  effect(() => {
    // Clear the stack if dependencies change
    dependencies?.();

    untracked(() => clear());
  });

  effect(() => runWithArgs(args(dependencies?.())));

  const runWithArgs = (args: RequestArgs<QueryArgsOf<TCreator>> | RequestArgs<QueryArgsOf<TCreator>>[] | null) => {
    if (args === null) return null;

    const newArgsArray = Array.isArray(args) ? args : [args];

    const newQueries = runInInjectionContext(injector, () =>
      newArgsArray.map(
        (newArgsEntry) =>
          queryCreator(
            withArgs(() => newArgsEntry),
            ...features,
          ) as QueryType,
      ),
    );

    const result = untracked(() => {
      const oldQueries = queries();

      if (append) {
        const { queries: appendedQueries, lastQuery: lastAppendedQuery } = appendFn(oldQueries, newQueries);
        queries.set(appendedQueries);
        lastQuery.set(lastAppendedQuery);

        return lastAppendedQuery;
      } else {
        for (const oldQuery of oldQueries) {
          if (!newQueries.some((q) => q.id() === oldQuery.id())) {
            oldQuery.subtle.destroy();
          }
        }
        queries.set(newQueries);

        const last = newQueries[newQueries.length - 1] ?? null;

        lastQuery.set(last);

        return last;
      }
    });

    return result;
  };

  const loading = computed(() => queries().some((q) => q.loading()));

  const error = computed(
    () =>
      queries()
        .map((q) => q.error())
        .find((e) => e !== null) ?? null,
  );

  const response = computed(() => {
    const responses = queries().map((q) => q.response());
    return transform?.(responses) ?? responses;
  }) as Signal<TTransform>;

  const execute = (options?: { allowCache?: boolean }) => {
    for (const query of queries()) {
      query.execute({ options: { allowCache: options?.allowCache } });
    }
  };

  const clear = () => {
    for (const query of queries()) {
      query.subtle.destroy();
    }

    queries.set([]);
    lastQuery.set(null);
  };

  const stack: QueryStack<QueryType, TCreator, TTransform> = {
    queries: queries.asReadonly(),
    lastQuery: lastQuery.asReadonly(),
    firstQuery,
    loading,
    error,
    response,
    execute,
    clear,
    subtle: {
      runWithArgs,
    },
  };

  return stack;
};
