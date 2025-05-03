import {
  CreateComputedOptions,
  Injector,
  Signal,
  assertInInjectionContext,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ToObservableOptions, ToSignalOptions, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { computedTillTruthy, createDestroy, syncSignal } from '@ethlete/core';
import { Observable, Subscribable, of, pairwise, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { AnyLegacyQuery } from '../experimental';
import {
  AnyQuery,
  AnyQueryCollection,
  QueryOf,
  QueryState,
  QueryStateType,
  extractQuery,
  filterQueryStates,
  isQuery,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
} from '../query';
import { QueryDataOf } from '../query-creator';

export interface QueryContainerConfig {
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
}

export interface QueryFilterConfig {
  /**
   * If `true`, the response will be cached until the next response is received or the query fails.
   * @default false
   */
  cacheResponse?: boolean;
}

export const addQueryContainerHandling = (
  obs: Observable<AnyQuery | AnyQuery[] | null>,
  valueFn: () => AnyQuery | AnyQuery[] | null | undefined,
  config?: QueryContainerConfig,
) => {
  assertInInjectionContext(addQueryContainerHandling);

  const { abortPrevious, abortOnDestroy, stopPreviousPolling } = config ?? {};

  const injector = inject(Injector);
  const destroy$ = createDestroy();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tNode = (injector as any)._tNode;
  const componentId = tNode?.index ?? -1;

  obs
    .pipe(
      takeUntil(destroy$),
      startWith(null),
      pairwise(),
      tap(([prevQuery, currQuery]) => {
        const cleanQuery = (q: AnyQuery | null | undefined) => {
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

    const handleQuery = (q: AnyQuery | null | undefined) => {
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

export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
): Signal<T | undefined>;
export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | undefined>> & {
    initialValue?: undefined;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | undefined>;
export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | null>> & {
    initialValue?: null;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | null>;
export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T>> & {
    initialValue?: undefined;
    requireSync: true;
  } & QueryContainerConfig,
): Signal<T>;
export function toQuerySignal<T extends AnyQuery | null, const U extends T>(
  source: Observable<T> | Subscribable<T>,
  options: NoInfer<ToSignalOptions<T | U>> & {
    initialValue: U;
    requireSync?: false;
  } & QueryContainerConfig,
): Signal<T | U>;

export function toQuerySignal<T extends AnyQuery | null, U = undefined>(
  source: Observable<T> | Subscribable<T>,
  options?: ToSignalOptions<T | U> & { initialValue?: U } & QueryContainerConfig,
): Signal<T | U> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = toSignal(source, options as any);

  addQueryContainerHandling(source as Observable<T>, () => s() as T, options);

  return s as Signal<T | U>;
}

export function queryComputed<T extends AnyQuery | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T> {
  const c = computed(computation, options);
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

/**
 * Creates a signal that will only be reactive until the first query is created.
 * All subsequent changes inside the computation will be ignored.
 */
export function queryComputedTillTruthy<T extends AnyQuery | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T | null> {
  const c = computedTillTruthy(computed(computation, options));
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

export function queryArrayComputed<T extends AnyQuery[] | null>(
  computation: () => T,
  options?: CreateComputedOptions<T> & QueryContainerConfig & ToObservableOptions,
): Signal<T> {
  const c = computed(computation, options);
  const obs = toObservable(c, options);

  addQueryContainerHandling(obs, () => c(), options);

  return c;
}

export function toQuerySubject<T extends AnyQuery | null>(
  source: Signal<T>,
  options?: ToObservableOptions & QueryContainerConfig,
): Observable<T> {
  const obs = toObservable(source, options);

  addQueryContainerHandling(obs, () => source(), options);

  return obs;
}

export function queryStateSignal<T extends Signal<AnyQuery | AnyQueryCollection | null>>(
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
  ) as Signal<QueryState<QueryDataOf<QueryOf<ReturnType<T>>>> | null>;

  const rwSignal = signal<QueryState<QueryDataOf<QueryOf<ReturnType<T>>>> | null>(roSignal());

  syncSignal(roSignal, rwSignal);

  return rwSignal;
}

export type QueryStateSignal<T extends Signal<AnyQuery | AnyQueryCollection | null>> = Signal<QueryDataOf<
  QueryOf<ReturnType<T>>
> | null> & { reset: () => void };

export function queryStateResponseSignal<T extends Signal<AnyQuery | AnyQueryCollection | null>>(
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

export function queryStateErrorSignal<T extends Signal<AnyQuery | AnyQueryCollection | null>>(source: T) {
  const s = queryStateSignal(source);

  return computed(() => {
    const state = s();

    return isQueryStateFailure(state) ? state.error : null;
  });
}

export function queryStateLoadingSignal<T extends Signal<AnyQuery | AnyQueryCollection | null>>(source: T) {
  const s = queryStateSignal(source);

  return computed(() => {
    const state = s();

    return isQueryStateLoading(state) ? state : null;
  });
}
