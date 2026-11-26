import { Observable, filter, map, of, take, timeout } from 'rxjs';

export const AGENT_API_LOCKED_MESSAGE = 'Timetrack is locked. Unlock it, then ask again.';

/**
 * How long the window waits for its own lock to open on an op the host already let through. The host
 * hands a waiting op over the moment the password checks out, which can be before the window has
 * heard that it is unlocked.
 */
export const AGENT_API_UNLOCK_GRACE_MS = 5_000;

/** The refusal a locked app answers every op with, read or write, or `null` while it is unlocked. */
export const agentApiLockRefusal = (options: { locked: boolean }) => (options.locked ? AGENT_API_LOCKED_MESSAGE : null);

/** The same, waiting up to `graceMs` for `locked$` to report the window unlocked before it refuses. */
export const agentApiLockRefusal$ = (
  locked$: Observable<boolean>,
  graceMs = AGENT_API_UNLOCK_GRACE_MS,
): Observable<string | null> =>
  locked$.pipe(
    filter((locked) => !locked),
    take(1),
    map(() => null),
    timeout({ first: graceMs, with: () => of(AGENT_API_LOCKED_MESSAGE) }),
  );
