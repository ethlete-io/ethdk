import { Signal, WritableSignal, afterNextRender, effect, isDevMode, isSignal, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { map, pairwise } from 'rxjs';

export const previousSignalValue = <T>(signal: Signal<T>) => {
  const obs = toObservable(signal).pipe(
    pairwise(),
    map(([prev]) => prev),
  );

  return toSignal(obs);
};

export type SyncSignalOptions = {
  /**
   * If true, the target signal will not be updated with the source signal's value in a sync operation.
   * This should be set to true for signals that need to be initialized first before syncing (eg. required inputs)
   * @default false
   */
  skipSyncRead?: boolean;

  /**
   * If true, the first time the effect will be triggered will be skipped.
   * @default false
   */
  skipFirstRun?: boolean;
};

export const syncSignal = <T>(from: Signal<T>, to: WritableSignal<T>, options?: SyncSignalOptions) => {
  let isFirstRun = options?.skipSyncRead ? false : true;

  if (!options?.skipSyncRead) {
    try {
      // this might throw if the signal is not yet initialized (eg. a required signal input inside the constructor)
      // in that case we just skip the initial sync
      to.set(from());
    } catch {
      isFirstRun = false;

      if (isDevMode()) {
        console.warn('Failed to sync signals. The target signal is not yet initialized.', { from, to });
      }
    }
  }

  const ref = effect(() => {
    const formVal = from();

    if (options?.skipFirstRun && isFirstRun) {
      isFirstRun = false;
      return;
    }

    untracked(() => {
      to.set(formVal);
    });
  });

  return ref;
};

export type MaybeSignal<T> = T | Signal<T>;

export const maybeSignalValue = <T>(value: MaybeSignal<T>) => {
  if (isSignal(value)) {
    return value();
  }

  return value;
};

/**
 * A computed that will only be reactive until the source signal contains a truthy value.
 * All subsequent changes inside the computation will be ignored.
 */
export const computedTillTruthy = <T>(source: Signal<T>) => {
  const value = signal<T | null>(null);

  const ref = effect(() => {
    const val = source();

    if (val) {
      value.set(val);
      ref.destroy();
    }
  });

  return value.asReadonly();
};

/**
 * A computed that will only be reactive until the source signal contains a falsy value.
 * All subsequent changes inside the computation will be ignored.
 */
export const computedTillFalsy = <T>(source: Signal<T>) => {
  const value = signal<T | null>(null);

  const ref = effect(() => {
    const val = source();

    if (!val) {
      value.set(val);
      ref.destroy();
    }
  });

  return value.asReadonly();
};

/**
 * A writeable signal that will be set to the provided value once all inputs are set.
 * During that time, the signal will be set to `null`.
 */
export const deferredSignal = <T extends () => unknown>(valueFn: T) => {
  const valueSignal = signal<ReturnType<T> | null>(null);

  afterNextRender(() => {
    valueSignal.set(valueFn() as ReturnType<T>);
  });

  return valueSignal;
};
