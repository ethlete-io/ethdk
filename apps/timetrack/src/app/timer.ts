import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { TimerRun } from '@ethlete/timetrack';
import { EMPTY, Subject, catchError, exhaustMap, merge, switchMap, tap, timer } from 'rxjs';
import { TIMER_TOGGLE_EVENT, hostEvent$, injectHostPorts } from '../host';

/**
 * How often a running run's elapsed time is recomputed.
 *
 * A worklog is logged in quarter hours, so a second-by-second readout would be precision the rest of
 * the app cannot use, and every tick of it would rewrite a tray menu entry.
 */
const TIMER_TICK_MS = 30_000;

/**
 * The explicit half of the hybrid model: a run the user starts and stops by hand.
 *
 * Only the open run is state here. A run reaches the day review the way every observation does - through
 * the store and the engine - so one made while the window was hidden is already in the day that the
 * next read reconstructs, and `revision` is what tells the readers a read is now worth redoing.
 */
const TIMER_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const running = signal<TimerRun | null>(null);
  const now = signal(new Date());
  const failure = signal<string | null>(null);
  const revision = signal(0);
  const toggles$ = new Subject<void>();
  const labels$ = new Subject<{ id: string; issueKey: string; note: string }>();

  const failed = (error: unknown) => {
    failure.set(error instanceof Error ? error.message : String(error));

    return EMPTY;
  };

  const settle = (run: TimerRun | null) => {
    running.set(run);
    revision.update((count) => count + 1);
  };

  ports.timers
    .running$()
    .pipe(
      tap((run) => running.set(run)),
      catchError(failed),
      takeUntilDestroyed(),
    )
    .subscribe();

  merge(hostEvent$(TIMER_TOGGLE_EVENT), toggles$)
    .pipe(
      exhaustMap(() => {
        const at = new Date();

        failure.set(null);

        return (running() ? ports.timers.stop$(at) : ports.timers.start$(at)).pipe(catchError(failed));
      }),
      tap(settle),
      takeUntilDestroyed(),
    )
    .subscribe();

  labels$
    .pipe(
      switchMap((label) =>
        ports.timers.label$(label.id, { issueKey: label.issueKey, note: label.note }).pipe(catchError(failed)),
      ),
      tap(() => revision.update((count) => count + 1)),
      takeUntilDestroyed(),
    )
    .subscribe();

  timer(TIMER_TICK_MS, TIMER_TICK_MS)
    .pipe(
      tap(() => now.set(new Date())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    running: running.asReadonly(),
    failure: failure.asReadonly(),
    /** Bumped whenever a run started, stopped or was named, so a day already read is read again. */
    revision: revision.asReadonly(),
    elapsedMs: computed(() => {
      const run = running();

      return run ? Math.max(0, now().getTime() - run.from.getTime()) : 0;
    }),

    toggle: () => toggles$.next(),
    label: (id: string, label: { issueKey: string; note: string }) => labels$.next({ id, ...label }),
  };
});

export const injectTimer = /* @__PURE__ */ toInjectFn(TIMER_DEF);
