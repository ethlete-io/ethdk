import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injector, runInInjectionContext, Signal, signal, untracked } from '@angular/core';
import { AnyQuery, RequestArgs, ResponseType } from './query';
import { AnyQueryCreator, QueryArgsOf, RunQueryCreator } from './query-creator';
import { withArgs } from './query-features';

export type QueryStack<TQuery extends AnyQuery, TTransform> = {
  /** Contains all queries in the stack. */
  queries: Signal<TQuery[]>;

  /** Contains the last query in the stack. Useful for getting current pagination values. */
  lastQuery: Signal<TQuery | null>;

  /** True if any query in the stack is loading. */
  loading: Signal<boolean>;

  /** Contains the first error that occurred in the stack. */
  error: Signal<HttpErrorResponse | null>;

  /** Contains the responses of all queries in the stack. Will be `null` for queries that are loading or errored. */
  response: Signal<TTransform>;

  /** Executes all queries in the stack. */
  execute: (options?: { allowCache?: boolean }) => void;

  /** Destroys all queries in the stack and empties it. This should only be used if `append` is true. */
  clear: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQueryStack = QueryStack<AnyQuery, any>;

export type CreateQueryStackOptions<
  TCreator extends AnyQueryCreator,
  TTransform = (ResponseType<QueryArgsOf<TCreator>> | null)[],
> = {
  /**
   * The query creator function that will be used to create the query stack.
   */
  queryCreator: TCreator;

  /**
   * The arguments to create queries with.
   * This function can be treated like a computed function. It reacts to signal changes.
   * If a signal changes, a new query will be created (and appended to the existing ones if `append` is true).
   *
   * @example () => ({ queryParams: { postId: myId() } }),
   */
  args: () => RequestArgs<QueryArgsOf<TCreator>> | null;

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
  TTransform = (ResponseType<TArgs> | null)[],
>(
  options: CreateQueryStackOptions<TCreator, TTransform>,
) => {
  type QueryType = RunQueryCreator<TCreator>;

  const {
    args,
    queryCreator,
    append,
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

  effect(() => {
    const newArgs = args();

    if (newArgs === null) return;

    const newQueries = runInInjectionContext(injector, () => [
      queryCreator(
        withArgs(() => {
          return newArgs;
        }),
      ) as QueryType,
    ]);

    untracked(() => {
      const oldQueries = queries();

      if (append) {
        const { queries: appendedQueries, lastQuery: lastAppendedQuery } = appendFn(oldQueries, newQueries);
        queries.set(appendedQueries);
        lastQuery.set(lastAppendedQuery);
      } else {
        for (const oldQuery of oldQueries) {
          if (!newQueries.some((q) => q.id() === oldQuery.id())) {
            oldQuery.internals.destroy();
          }
        }
        queries.set(newQueries);
        lastQuery.set(newQueries[newQueries.length - 1] ?? null);
      }
    });
  });

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
      query.internals.destroy();
    }

    queries.set([]);
    lastQuery.set(null);
  };

  const stack: QueryStack<QueryType, TTransform> = {
    queries: queries.asReadonly(),
    lastQuery: lastQuery.asReadonly(),
    loading,
    error,
    response,
    execute,
    clear,
  };

  return stack;
};
