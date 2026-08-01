import { DestroyRef, Injector, Signal, signal } from '@angular/core';
import { of } from 'rxjs';
import { ObservableSignal, Query, QueryArgs, QuerySnapshot, RequestArgs, ResponseType } from '../../http';

/**
 * A query that never executes and never leaves its initial state.
 *
 * `LegacyQueryCreator.prepare()` hands one back when the injector it was given is already destroyed
 * - the shape v2 call sites still fire into during teardown (a debounced search resolving after the
 * user navigated away, an RxJS callback on a stream that has not been unsubscribed yet). v2 had no
 * injector at all there, so the same code used to be harmless; building a real query would now
 * throw NG0205 from inside the view's cleanup phase, with no hint about which query caused it.
 *
 * Everything reads as "prepared but never executed": `execute()` and friends are no-ops, signals
 * stay `null`, observables complete immediately. Nothing here touches Angular's DI, which is the
 * point - there is no live injector left to bind to.
 */
export const createInertQuery = <TArgs extends QueryArgs>(): Query<TArgs> => {
  const inertSignal = <T>(value: T): ObservableSignal<T> =>
    Object.assign(signal(value) as Signal<T>, { asObservable: () => of(value) });

  const noop = () => {
    /* the query is inert - there is nothing to execute, reset or destroy */
  };

  const base = {
    args: inertSignal<RequestArgs<TArgs> | null>(null),
    response: inertSignal<ResponseType<TArgs> | null>(null),
    latestHttpEvent: inertSignal(null),
    loading: inertSignal(null),
    error: inertSignal(null),
    lastTimeExecutedAt: inertSignal<number | null>(null),
    triggeredBy: inertSignal<string | null>(null),
    id: inertSignal<string | null>(null),
    executionState: inertSignal(null),
  } as unknown as QuerySnapshot<TArgs>;

  const createSnapshot = (): QuerySnapshot<TArgs> => ({ ...base, isAlive: inertSignal(false) });

  // A DestroyRef that is already destroyed: callbacks registered on it are dropped rather than
  // stored, so nothing keeps this object (or its registrant) alive.
  const destroyRef = {
    destroyed: true,
    onDestroy: () => noop,
  } as unknown as DestroyRef;

  return {
    ...base,
    execute: noop,
    createSnapshot,
    reset: noop,
    asReadonly: () => ({ ...base, createSnapshot }),
    subtle: {
      destroy: noop,
      setResponse: noop,
      setLoading: noop,
      setError: noop,
      request: inertSignal(null),
      destroyRef,
      injector: Injector.NULL,
    },
  } as unknown as Query<TArgs>;
};
