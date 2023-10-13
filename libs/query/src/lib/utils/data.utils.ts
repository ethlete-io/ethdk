import { Injector, Signal, assertInInjectionContext, inject } from '@angular/core';
import { ToObservableOptions, ToSignalOptions, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
import { Observable, Subscribable, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { AnyQuery } from '../query';

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
}

export const addQueryContainerHandling = (
  obs: Observable<AnyQuery | null>,
  valueFn: () => AnyQuery | null | undefined,
  config?: QueryContainerConfig,
) => {
  assertInInjectionContext(addQueryContainerHandling);

  const { abortPrevious, abortOnDestroy } = config ?? {};

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
        prevQuery?._removeDependent(componentId);
        currQuery?._addDependent(componentId);

        if (
          !prevQuery?._hasDependents() &&
          ((abortPrevious === undefined && prevQuery?.canBeCached) || abortPrevious)
        ) {
          prevQuery?.abort();
        }
      }),
    )
    .subscribe();

  destroy$.subscribe(() => {
    const query = valueFn();

    query?._removeDependent(componentId);

    if (!query?._hasDependents() && ((query?.canBeCached && abortOnDestroy === undefined) || abortOnDestroy)) {
      query?.abort();
    }
  });
};

export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
): Signal<T | undefined>;
export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options?: ToSignalOptions<undefined> & { requireSync?: false } & QueryContainerConfig,
): Signal<T | undefined>;
export function toQuerySignal<T extends AnyQuery | null, U extends T | null | undefined>(
  source: Observable<T> | Subscribable<T>,
  options: ToSignalOptions<U> & { initialValue: U; requireSync?: false } & QueryContainerConfig,
): Signal<T | U>;
export function toQuerySignal<T extends AnyQuery | null>(
  source: Observable<T> | Subscribable<T>,
  options: ToSignalOptions<undefined> & { requireSync: true } & QueryContainerConfig,
): Signal<T>;
export function toQuerySignal<T extends AnyQuery | null, U = undefined>(
  source: Observable<T> | Subscribable<T>,
  options?: ToSignalOptions<U> & QueryContainerConfig,
): Signal<T | U> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = toSignal(source, options as any);

  addQueryContainerHandling(source as Observable<T>, () => s() as T, options);

  return s as Signal<T | U>;
}

export function toQueryComputed<T extends AnyQuery | null>(
  source: Signal<T>,
  options?: QueryContainerConfig & ToObservableOptions,
) {
  const obs = toObservable(source, options);

  addQueryContainerHandling(obs, () => source(), options);

  return source;
}

export function toQuerySubject<T extends AnyQuery | null>(
  source: Signal<T>,
  options?: ToObservableOptions & QueryContainerConfig,
): Observable<T> {
  const obs = toObservable(source, options);

  addQueryContainerHandling(obs, () => source(), options);

  return obs;
}
