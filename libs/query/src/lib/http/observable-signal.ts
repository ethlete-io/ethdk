import { Injector, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { createObservableSignalWatcher } from './observable-signal-watcher';

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

export const wrapAsObservableSignal = <T>(source: Signal<T>, defaultInjector: Injector): ObservableSignal<T> =>
  createObservableSignalWatcher(defaultInjector).wrap(source);
