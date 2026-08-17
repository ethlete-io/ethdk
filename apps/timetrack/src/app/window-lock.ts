import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { EMPTY, Subject, catchError, exhaustMap, tap } from 'rxjs';
import { WINDOW_LOCKED_EVENT, hostEvent$, injectHostPorts } from '../host';

/**
 * Whether this window may show what it holds.
 *
 * The lock is over the window and never over the database: the collectors write every minute, and a
 * closed database would punch a hole in the day. So nothing here stops collection - what it gates is
 * the display, and every view has to render nothing while `isLocked` is true.
 *
 * `ready` is what keeps a view from flashing into sight before the answer arrives. Until the host has
 * said, the window shows neither the app nor the prompt.
 */
const WINDOW_LOCK_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const isLocked = signal(true);
  const ready = signal(false);
  const promptsItself = signal(false);
  const isChecking = signal(false);
  const wasRefused = signal(false);
  const failure = signal<string | null>(null);
  const attempts$ = new Subject<string | undefined>();

  const failed = (error: unknown) => {
    failure.set(error instanceof Error ? error.message : String(error));

    return EMPTY;
  };

  ports.windowLock
    .state$()
    .pipe(
      tap((state) => {
        isLocked.set(state.locked);
        promptsItself.set(state.promptsItself);
        ready.set(true);
      }),
      catchError((error: unknown) => {
        // A window with no host behind it is not a locked one: a story or a browser tab has no lock
        // to read, and leaving it locked forever would make the app unopenable there.
        ready.set(true);
        isLocked.set(false);

        return failed(error);
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  hostEvent$(WINDOW_LOCKED_EVENT)
    .pipe(
      tap(() => {
        isLocked.set(true);
        wasRefused.set(false);
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  /**
   * `exhaustMap`, so pressing unlock twice does not send the password twice. A wrong one costs two
   * seconds inside PAM, which is the rate limit, and queueing attempts behind it would defeat it.
   */
  attempts$
    .pipe(
      exhaustMap((password) => {
        isChecking.set(true);
        wasRefused.set(false);
        failure.set(null);

        return ports.windowLock.unlock$(password).pipe(catchError(failed));
      }),
      tap((verified) => {
        isChecking.set(false);
        isLocked.set(!verified);
        wasRefused.set(!verified);
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    isLocked: isLocked.asReadonly(),
    ready: ready.asReadonly(),
    promptsItself: promptsItself.asReadonly(),
    isChecking: isChecking.asReadonly(),
    wasRefused: wasRefused.asReadonly(),
    failure: failure.asReadonly(),

    unlock: (password?: string) => attempts$.next(password),

    lock: () =>
      ports.windowLock
        .lock$()
        .pipe(
          tap(() => isLocked.set(true)),
          catchError(failed),
        )
        .subscribe(),
  };
});

export const injectWindowLock = /* @__PURE__ */ toInjectFn(WINDOW_LOCK_DEF);
