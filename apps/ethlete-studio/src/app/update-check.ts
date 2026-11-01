import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, catchError, exhaustMap, takeWhile, tap, timer } from 'rxjs';
import { updateReady$ } from '../host/update';

export const UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

const UPDATE_CHECK_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const version = signal<string | null>(null);

  timer(0, UPDATE_CHECK_INTERVAL_MS)
    .pipe(
      takeWhile(() => !version()),
      exhaustMap(() =>
        updateReady$().pipe(
          tap((found) => version.set(found)),
          catchError(() => EMPTY),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    /** The downloaded release the host installs when Studio quits, or `null` while there is none. */
    version: version.asReadonly(),
  };
});

/** Starts the quiet update check: it downloads a newer release, and the next Studio start runs it. */
export const injectUpdateCheck = /* @__PURE__ */ toInjectFn(UPDATE_CHECK_DEF);
