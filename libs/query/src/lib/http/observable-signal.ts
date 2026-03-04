import { DestroyRef, Injector, Signal } from '@angular/core';
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
  const asObservable = (options?: { injector?: Injector }): Observable<T> => {
    const effectiveInjector = options?.injector ?? defaultInjector;
    const base$ = toObservable(source, { injector: effectiveInjector });

    if (options?.injector) {
      return base$.pipe(takeUntilDestroyed(defaultInjector.get(DestroyRef)));
    }

    return base$;
  };

  return Object.assign(source, { asObservable }) as unknown as ObservableSignal<T>;
};
