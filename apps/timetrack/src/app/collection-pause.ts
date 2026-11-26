import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Subject, catchError, exhaustMap, merge, tap, timer } from 'rxjs';
import { COLLECTION_PAUSE_TOGGLE_EVENT, CollectionState, hostEvent$, injectHostPorts } from '../host';

/** How often the paused-for readout is recomputed. A pause is read in minutes, not seconds. */
const PAUSE_TICK_MS = 30_000;

/**
 * The hard pause: while it is on, nothing on this machine is watched.
 *
 * The host owns the state, not this provider - the samplers run whether or not a window is open, and
 * they have to honour a pause the app was restarted in. What lives here is the reading of it, and the
 * one rule every collector obeys: while `isPaused` is true, a collector does no work at all. Draining
 * what the host buffered *before* the pause is not collection, but it is held back too, so that
 * "paused" is never a state in which something is still storing.
 */
const COLLECTION_PAUSE_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const state = signal<CollectionState>({ pausedAt: null });
  const now = signal(new Date());
  const failure = signal<string | null>(null);
  const toggles$ = new Subject<void>();

  const failed = (error: unknown) => {
    failure.set(error instanceof Error ? error.message : String(error));

    return EMPTY;
  };

  ports.collection
    .state$()
    .pipe(
      tap((next) => state.set(next)),
      catchError(failed),
      takeUntilDestroyed(),
    )
    .subscribe();

  /**
   * `exhaustMap`, so a second click while the first is in flight is dropped rather than queued. The
   * host is what decides the outcome, and two toggles racing would ask it for the opposite of what
   * the user last pressed.
   */
  merge(hostEvent$(COLLECTION_PAUSE_TOGGLE_EVENT), toggles$)
    .pipe(
      exhaustMap(() => {
        failure.set(null);

        return ports.collection.setPaused$(!state().pausedAt, new Date()).pipe(catchError(failed));
      }),
      tap((next) => state.set(next)),
      takeUntilDestroyed(),
    )
    .subscribe();

  timer(PAUSE_TICK_MS, PAUSE_TICK_MS)
    .pipe(
      tap(() => now.set(new Date())),
      takeUntilDestroyed(),
    )
    .subscribe();

  const pausedAt = computed(() => state().pausedAt);

  return {
    pausedAt,
    isPaused: computed(() => !!pausedAt()),
    failure: failure.asReadonly(),
    pausedForMs: computed(() => {
      const since = pausedAt();

      return since ? Math.max(0, now().getTime() - since.getTime()) : 0;
    }),

    toggle: () => toggles$.next(),
  };
});

export const injectCollectionPause = /* @__PURE__ */ toInjectFn(COLLECTION_PAUSE_DEF);
