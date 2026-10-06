import { computed, DestroyRef, effect, Injector, Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, ReplaySubject } from 'rxjs';
import { ObservableSignal } from './observable-signal';

type WatchedSignal<T> = {
  source: Signal<T>;
  subject: ReplaySubject<T>;
  hasValue: boolean;
  last: T | undefined;
};

export type ObservableSignalWatcher = {
  wrap: <T>(source: Signal<T>) => ObservableSignal<T>;
};

export const createObservableSignalWatcher = (injector: Injector): ObservableSignalWatcher => {
  const destroyRef = injector.get(DestroyRef);
  const watched: WatchedSignal<unknown>[] = [];
  const registrations = signal(0);
  let watching = false;
  let destroyed = false;

  const push = <T>(entry: WatchedSignal<T>) => {
    if (entry.subject.closed || entry.subject.isStopped) return;

    let value: T;

    try {
      value = entry.source();
    } catch (error) {
      untracked(() => entry.subject.error(error));
      return;
    }

    if (entry.hasValue && Object.is(value, entry.last)) return;

    entry.hasValue = true;
    entry.last = value;
    untracked(() => entry.subject.next(value));
  };

  const startWatching = () => {
    if (watching) return;

    watching = true;

    effect(
      () => {
        registrations();

        for (const entry of watched) push(entry);
      },
      { injector },
    );

    destroyRef.onDestroy(() => {
      destroyed = true;

      for (const entry of watched) entry.subject.complete();
    });
  };

  const watch = <T>(source: Signal<T>): WatchedSignal<T> => {
    const entry: WatchedSignal<T> = { source, subject: new ReplaySubject<T>(1), hasValue: false, last: undefined };

    if (destroyed || destroyRef.destroyed) {
      push(entry);
      entry.subject.complete();

      return entry;
    }

    startWatching();
    watched.push(entry as WatchedSignal<unknown>);
    push(entry);
    registrations.update((count) => count + 1);

    return entry;
  };

  const wrap = <T>(source: Signal<T>): ObservableSignal<T> => {
    let default$: Observable<T> | null = null;
    const overrides = new WeakMap<Injector, Observable<T>>();

    const getDefault = () => {
      if (default$) return default$;

      const entry = untracked(() => watch(source));

      default$ = new Observable<T>((subscriber) => {
        untracked(() => push(entry));

        return entry.subject.subscribe(subscriber);
      });

      return default$;
    };

    const asObservable = (options?: { injector?: Injector }): Observable<T> => {
      const overrideInjector = options?.injector;

      if (!overrideInjector) return getDefault();

      const existing = overrides.get(overrideInjector);

      if (existing) return existing;

      const override$ = getDefault().pipe(takeUntilDestroyed(overrideInjector.get(DestroyRef)));
      overrides.set(overrideInjector, override$);

      return override$;
    };

    return Object.assign(
      computed(() => source()),
      { asObservable },
    );
  };

  return { wrap };
};
