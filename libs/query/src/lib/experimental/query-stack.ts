import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injector, runInInjectionContext, Signal, signal, untracked } from '@angular/core';
import { AnyQuery } from './query';

export type QueryStack<T extends AnyQuery> = {
  /** Contains all queries in the stack. */
  queries: Signal<T[]>;

  /** Contains the last query in the stack. Useful for getting current pagination values. */
  lastQuery: Signal<T | null>;

  /** True if any query in the stack is loading. */
  loading: Signal<boolean>;

  /** Contains the first error that occurred in the stack. */
  error: Signal<HttpErrorResponse | null>;

  /** Contains the responses of all queries in the stack. Will be `null` for queries that are loading or errored. */
  response: Signal<ReturnType<T['response']>[]>;

  /** Executes all queries in the stack. */
  execute: () => void;

  /** Destroys all queries in the stack and empties it. This should only be used if `append` is true. */
  clear: () => void;
};

export type AnyQueryStack = QueryStack<AnyQuery>;

export type CreateQueryStackOptions<T extends AnyQuery> = {
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
    oldQueries: T[],
    newQueries: T[],
  ) => {
    /** The new queries merged with the old ones. */
    queries: T[];

    /** The last query in the new queries. */
    lastQuery: T | null;
  };
};

export const createQueryStack = <T extends AnyQuery>(
  computation: () => T | T[],
  options?: CreateQueryStackOptions<T>,
) => {
  const {
    append = false,
    appendFn = (oldQueries: T[], newQueries: T[]) => {
      const queries = [...oldQueries, ...newQueries];
      const lastQuery = newQueries[newQueries.length - 1] ?? oldQueries[oldQueries.length - 1] ?? null;

      return { queries, lastQuery };
    },
  } = options ?? {};
  const injector = inject(Injector);

  const queries = signal<T[]>([]);
  const lastQuery = signal<T | null>(null);

  effect(() => {
    const newQueryOrQueries = runInInjectionContext(injector, () => computation());
    const newQueries = Array.isArray(newQueryOrQueries) ? newQueryOrQueries : [newQueryOrQueries];

    untracked(() => {
      const oldQueries = queries();

      if (append) {
        const { queries: appendedQueries, lastQuery: lastAppendedQuery } = appendFn(oldQueries, newQueries);
        queries.set(appendedQueries);
        lastQuery.set(lastAppendedQuery);
      } else {
        for (const oldQuery of oldQueries) {
          if (!newQueries.some((q) => q.id() === oldQuery.id())) {
            oldQuery.destroy();
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
  const response = computed(() => queries().map((q) => q.response()));

  const execute = () => {
    for (const query of queries()) {
      query.execute();
    }
  };

  const clear = () => {
    for (const query of queries()) {
      query.destroy();
    }

    queries.set([]);
    lastQuery.set(null);
  };

  const stack: QueryStack<T> = {
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
