import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Signal, computed, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, map, of, switchMap, timer } from 'rxjs';

export type SignalDeferredLoadingOptions = {
  /** How long the source must stay truthy before the indicator turns on, in ms. @default 200 */
  delay?: number;
  /** How long the indicator stays on once it turned on, in ms. @default 300 */
  minDuration?: number;
};

/**
 * Gates a loading indicator on a loading flag, so work that finishes quickly never flashes one: the
 * returned signal turns true only once `source` has been true for `delay` ms, and then stays true for
 * `minDuration` ms even if the work has already finished.
 *
 * Use it for what the reader *sees* - a spinner, a busy bar, a skeleton - and keep the raw flag for
 * everything else (`aria-busy`, whether a request is in flight, geometry that must not jump).
 *
 * Call in an injection context.
 *
 * ```ts
 * protected showSpinner = signalDeferredLoading(this.loading);
 * ```
 */
export const signalDeferredLoading = (
  source: () => boolean,
  options?: SignalDeferredLoadingOptions,
): Signal<boolean> => {
  const delay = options?.delay ?? 200;
  const minDuration = options?.minDuration ?? 300;

  const visible = signal(false);

  // Nothing to defer on the server - there is no first paint to protect, and a pending timer would
  // hold up serialization for as long as it runs.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return visible.asReadonly();
  }

  let shownAt = 0;

  toObservable(computed(() => source()))
    .pipe(
      switchMap((loading) => {
        if (loading === untracked(visible)) {
          return EMPTY;
        }

        if (loading) {
          return timer(delay).pipe(map(() => true));
        }

        const remaining = minDuration - (performance.now() - shownAt);

        return remaining <= 0 ? of(false) : timer(remaining).pipe(map(() => false));
      }),
      takeUntilDestroyed(),
    )
    .subscribe((isVisible) => {
      if (isVisible) {
        shownAt = performance.now();
      }

      visible.set(isVisible);
    });

  return visible.asReadonly();
};
