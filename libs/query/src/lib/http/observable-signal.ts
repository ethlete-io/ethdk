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
  const default$ = toObservable(source, { injector: defaultInjector });

  const asObservable = (options?: { injector?: Injector }): Observable<T> => {
    if (options?.injector) {
      return toObservable(source, { injector: options.injector }).pipe(
        takeUntilDestroyed(defaultInjector.get(DestroyRef)),
      );
    }

    return default$;
  };

  return Object.assign(source, { asObservable }) as unknown as ObservableSignal<T>;
};
