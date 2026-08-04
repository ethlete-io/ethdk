import {
  CreateComputedOptions,
  Injector,
  Signal,
  assertInInjectionContext,
  computed,
  effect,
  inject,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { ToObservableOptions, ToSignalOptions, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { computedTillTruthy, createDestroy } from '@ethlete/core';
import { Observable, Subscribable, of, pairwise, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { AnyLegacyQuery } from '../interop';
import {
  AnyQueryCollection,
  AnyV2Query,
  QueryOf,
  QueryStateType,
  V2QueryState,
  extractQuery,
  filterQueryStates,
  isQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
} from '../query';
import { QueryDataOf } from '../query-creator';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryContainerConfig = {
  /**
   * If `true`, the previous query will be aborted when a new query is pushed into the container.
   * @default true // Only if the request can be cached (GET, OPTIONS, HEAD and GQL_QUERY). Otherwise false.
   */
  abortPrevious?: boolean;

  /**
   * If `true`, the query will be aborted when the container is destroyed.
   * @default true // Only if the request can be cached (GET, OPTIONS, HEAD and GQL_QUERY). Otherwise false.
   */
  abortOnDestroy?: boolean;

  /**
   * If `true`, the previous polling will be stopped when a new query is pushed into the container.
   * @default true // Only if the query has no other dependents and the request can be cached (GET, OPTIONS, HEAD and GQL_QUERY). Otherwise false.
   */
  stopPreviousPolling?: boolean;

  /**
   * The injector owning the container. Defaults to the current injection context; pass one to build a
   * container outside of it - the container's lifecycle then follows that injector.
   */
  injector?: Injector;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryFilterConfig = {
  /**
   * If `true`, the response will be cached until the next response is received or the query fails.
   * @default false
   */
  cacheResponse?: boolean;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const addQueryContainerHandling = (
  obs: Observable<AnyV2Query | AnyV2Query[] | AnyLegacyQuery | AnyLegacyQuery[] | null>,
  valueFn: () => AnyV2Query | AnyV2Query[] | AnyLegacyQuery | AnyLegacyQuery[] | null | undefined,
  config?: QueryContainerConfig,
) => {
  if (!config?.injector) {
    assertInInjectionContext(addQueryContainerHandling);
  }

  const { abortPrevious, abortOnDestroy, stopPreviousPolling } = config ?? {};

  const injector = config?.injector ?? inject(Injector);
  const destroy$ = runInInjectionContext(injector, () => createDestroy());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tNode = (injector as any)._tNode;
  const componentId = tNode?.index ?? -1;

  obs
    .pipe(
      takeUntil(destroy$),
      startWith(null),
      pairwise(),
      tap(([prevQuery, currQuery]) => {
        const cleanQuery = (q: AnyV2Query | AnyLegacyQuery | null | undefined) => {
          if (!q?._hasDependents() && ((abortPrevious === undefined && q?.canBeCached) || abortPrevious)) {
            q?.abort();
          }

          if (
            !q?._hasDependents() &&
            ((stopPreviousPolling === undefined && q?.canBeCached) || stopPreviousPolling) &&
            q?.isPolling
          ) {
            q?.stopPolling();
          }

          (q as unknown as AnyLegacyQuery)?.destroy?.();
        };

        if ((isQuery(prevQuery) || prevQuery === null) && (isQuery(currQuery) || currQuery === null)) {
          prevQuery?._removeDependent(componentId);
          currQuery?._addDependent(componentId);

          cleanQuery(prevQuery);
        } else if (
          (Array.isArray(prevQuery) || prevQuery === null) &&
          (Array.isArray(currQuery) || currQuery === null)
        ) {
          if (prevQuery) {
            for (let i = 0; i < prevQuery.length; i++) {
              prevQuery[i]?._removeDependent(componentId);
            }
          }

          if (currQuery) {
            for (let i = 0; i < currQuery.length; i++) {
              currQuery[i]?._addDependent(componentId);
            }
          }

          if (prevQuery) {
            for (let i = 0; i < prevQuery.length; i++) {
              cleanQuery(prevQuery[i]);
            }
          }
        } else if (
          (isQuery(prevQuery) && Array.isArray(currQuery)) ||
          (Array.isArray(prevQuery) && isQuery(currQuery))
        ) {
          throw new Error('Cannot mix queries and arrays of queries in the same query container.');
        }
      }),
    )
    .subscribe();

  destroy$.subscribe(() => {
    const query = valueFn();

    const handleQuery = (q: AnyV2Query | AnyLegacyQuery | null | undefined) => {
      q?._removeDependent(componentId);

      if (!q?._hasDependents() && ((q?.canBeCached && abortOnDestroy === undefined) || abortOnDestroy)) {
        q?.abort();
        (q as unknown as AnyLegacyQuery)?.destroy?.();
      }
    };

    if (isQuery(query)) {
      handleQuery(query);
    } else if (Array.isArray(query)) {
      for (const q of query) {
        handleQuery(q);
      }
    }
  });
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null>(
  source: Observable<T> | Subscribable<T>,
): Signal<T | undefined>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | undefined>> & {
    initialValue?: undefined;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | undefined>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | null>> & {
    initialValue?: null;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | null>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T>> & {
    initialValue?: undefined;
    requireSync: true;
  } & QueryContainerConfig,
): Signal<T>;
/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null, const U extends T>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | U>> & {
    initialValue: U;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | U>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySignal<T extends AnyV2Query | AnyLegacyQuery | null, U = undefined>(
  source: Observable<T> | Subscribable<T>,
  options?: ToSignalOptions<T | U> & { initialValue?: U } & QueryContainerConfig,
): Signal<T | U> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = toSignal(source, options as any);

  addQueryContainerHandling(source as Observable<T>, () => s() as T, options);

  return s as Signal<T | U>;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function effectComputed<T extends AnyV2Query | AnyLegacyQuery | AnyV2Query[] | AnyLegacyQuery[] | null>(
  computation: () => T,
  injector: Injector,
) {
  let initialData = null;

  try {
    initialData = runInInjectionContext(injector, () => computation());
  } catch {
    // Ignore errors in the initial computation
    // Angular might throw an error if required inputs are read but not available yet
  }

  const lastResult = signal<T>(initialData as T);

  effect(
    () => {
      const data = runInInjectionContext(injector, () => computation());

      untracked(() => {
        if (data === lastResult()) return;

        lastResult.set(data);
      });
    },
    { injector },
  );

  return lastResult.asReadonly();
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryComputed<T extends AnyV2Query | AnyLegacyQuery | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T> {
  const injector = options?.injector ?? inject(Injector);

  const c = effectComputed(computation, injector);
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

/**
 * Creates a signal that will only be reactive until the first query is created.
 * All subsequent changes inside the computation will be ignored.
 *
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryComputedTillTruthy<T extends AnyV2Query | AnyLegacyQuery | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T | null> {
  const injector = options?.injector ?? inject(Injector);

  const c = computedTillTruthy(effectComputed(computation, injector));
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryArrayComputed<T extends AnyV2Query[] | AnyLegacyQuery[] | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T> {
  const injector = options?.injector ?? inject(Injector);

  const c = effectComputed(computation, injector);
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function toQuerySubject<T extends AnyV2Query | AnyLegacyQuery | null>(
  source: Signal<T>,
  options?: ToObservableOptions & QueryContainerConfig,
): Observable<T> {
  const obs = toObservable(source, options);

  addQueryContainerHandling(obs, () => source(), options);

  return obs;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryStateSignal<T extends Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>>(
  source: T,
  options?: QueryFilterConfig,
) {
  const { cacheResponse } = options ?? {};

  const roSignal = toSignal(
    toObservable(source).pipe(
      switchMap((q) => extractQuery(q)?.state$ ?? of(null)),
      switchMap((state) => {
        if (cacheResponse) {
          return of(state).pipe(filterQueryStates([QueryStateType.Success, QueryStateType.Failure]));
        }

        return of(state);
      }),
    ),
    {
      initialValue: null,
    },
  ) as Signal<V2QueryState<QueryDataOf<QueryOf<ReturnType<T>>>> | null>;

  const rwSignal = linkedSignal<V2QueryState<QueryDataOf<QueryOf<ReturnType<T>>>> | null>(roSignal);

  return rwSignal;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type QueryStateSignal<T extends Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>> =
  Signal<QueryDataOf<QueryOf<ReturnType<T>>> | null> & { reset: () => void };

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryStateResponseSignal<T extends Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>>(
  source: T,
  options?: QueryFilterConfig,
) {
  const s = queryStateSignal(source, options);

  const dataSignal = computed(() => {
    const state = s();

    return isQueryStateSuccess(state) ? state.response : null;
  });

  (dataSignal as QueryStateSignal<T>)['reset'] = () => {
    s.set(null);
  };

  return dataSignal as QueryStateSignal<T>;
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryStateErrorSignal<T extends Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>>(
  source: T,
) {
  const s = queryStateSignal(source);

  return computed(() => {
    const state = s();

    return isQueryStateFailure(state) ? state.error : null;
  });
}

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export function queryStateLoadingSignal<T extends Signal<AnyV2Query | AnyLegacyQuery | AnyQueryCollection | null>>(
  source: T,
) {
  const s = queryStateSignal(source);

  return computed(() => {
    const state = s();

    return isQueryStateLoading(state) ? state : null;
  });
}
