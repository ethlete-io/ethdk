import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Subject, catchError, exhaustMap, merge, takeWhile, tap, timer } from 'rxjs';
import { updateReady$ } from '../host';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

export type UpdateCheckState = 'idle' | 'checking' | 'current' | 'failed';

const UPDATE_CHECK_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const version = signal<string | null>(null);
  const state = signal<UpdateCheckState>('idle');
  const requests$ = new Subject<void>();

  merge(timer(0, UPDATE_CHECK_INTERVAL_MS), requests$)
    .pipe(
      takeWhile(() => !version()),
      exhaustMap(() => {
        state.set('checking');

        return updateReady$().pipe(
          tap((found) => {
            version.set(found);
            state.set('current');
          }),
          catchError(() => {
            state.set('failed');

            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    /** The downloaded release, ready to install, or `null` while there is none. */
    version: version.asReadonly(),
    state: state.asReadonly(),
    check: () => requests$.next(),
  };
});

export const injectUpdateCheck = /* @__PURE__ */ toInjectFn(UPDATE_CHECK_DEF);
