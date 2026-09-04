import { computed, DestroyRef, Injector, Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

export type ObservableSignal<T> = Signal<T> & {
  /**
   * Converts this signal to an Observable.
   *
   * The observable lifetime is bounded by the signal owner's injector by default.
   * When an override injector is provided, the observable is bounded by whichever lifetime ends
   * first: `min(override injector lifetime, signal owner injector lifetime)`.
   */
  asObservable(options?: { injector?: Injector }): Observable<T>;
};

export const wrapAsObservableSignal = <T>(source: Signal<T>, defaultInjector: Injector): ObservableSignal<T> => {
  const default$ = toObservable(source, { injector: defaultInjector });
  const overrides = new WeakMap<Injector, Observable<T>>();

  const asObservable = (options?: { injector?: Injector }): Observable<T> => {
    const injector = options?.injector;

    if (!injector) return default$;

    const existing = overrides.get(injector);

    if (existing) return existing;

    const override$ = toObservable(source, { injector }).pipe(takeUntilDestroyed(defaultInjector.get(DestroyRef)));
    overrides.set(injector, override$);

    return override$;
  };

  return Object.assign(
    computed(() => source()),
    { asObservable },
  );
};
