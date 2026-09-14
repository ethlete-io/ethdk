import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { TempoHistory, fetchTempoHistory$, readJiraCredentials$, readTempoCredentials$ } from '@ethlete/timetrack';
import { catchError, combineLatest, filter, map, of, startWith, switchMap, take } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const NOTHING: TempoHistory = { patterns: [], loggedIssues: [], worklogs: [] };

/**
 * How far one read of the Tempo history got.
 *
 * The three failing states used to be one empty history, and a screen reading it could not tell a
 * machine with no token from a read still in flight or one that came back 401. They are different
 * answers to "why is there nothing here", and only `loading` is worth waiting for.
 */
export type TempoHistoryState =
  | { state: 'loading' }
  | { state: 'no-token' }
  | { state: 'ready'; history: TempoHistory }
  | { state: 'failed'; message: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What the user's own Tempo history holds: the standing commitments the recurrence rung attributes
 * from, and the issues the last weeks logged against at all.
 *
 * One reader for the whole window, read once and held for the session. The provider is lazy, so the
 * read runs when the first screen that needs a name injects it and never at start-up. It is a read
 * over weeks of worklogs, and the answer only changes when a week does — a screen that asked on
 * every day change would spend three calls to learn what it already knew.
 *
 * Tempo is an extra, not the day. No token, an expired one or an offline machine leaves every screen
 * reading exactly as it did before this was here, and `state` is what lets one say so out loud.
 */
const RECURRING_PATTERNS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();

  const revision = signal(0);

  /**
   * The read waits for the settings document, and must keep waiting.
   *
   * `settings()` falls back to the defaults while the document is still on its way, and the defaults
   * name no Jira host and no account — so a read started before it arrives resolves to `no-token` and
   * stays there for the session, because nothing re-subscribes. The recurrence rung and the naming
   * offer are both silently empty for the rest of the run.
   */
  const read = toSignal(
    toObservable(revision).pipe(
      switchMap(() => settings.ready$),
      switchMap((current) =>
        combineLatest({
          jira: readJiraCredentials$({ secrets: ports.secrets, settings: current }),
          tempo: readTempoCredentials$({ secrets: ports.secrets }),
        }).pipe(
          switchMap(({ jira, tempo }) =>
            jira && tempo
              ? fetchTempoHistory$({ transport: ports.transport, jira, tempo }).pipe(
                  map((history): TempoHistoryState => ({ state: 'ready', history })),
                )
              : of<TempoHistoryState>({ state: 'no-token' }),
          ),
          catchError((error: unknown) => of<TempoHistoryState>({ state: 'failed', message: messageOf(error) })),
          startWith<TempoHistoryState>({ state: 'loading' }),
        ),
      ),
    ),
    { initialValue: { state: 'loading' } as TempoHistoryState },
  );

  const history = computed(() => {
    const value = read();

    return value.state === 'ready' ? value.history : NOTHING;
  });

  const settled$ = toObservable(read).pipe(
    filter((value) => value.state !== 'loading'),
    take(1),
  );

  return {
    /** How far the read got, so a screen can say why it has nothing rather than showing nothing. */
    state: read,
    patterns: computed(() => history().patterns),
    /** Every issue the last weeks logged against, most recently logged first. */
    loggedIssues: computed(() => history().loggedIssues),
    /** The same weeks' worklogs, for a reader that needs how much time an issue holds. */
    worklogs: computed(() => history().worklogs),
    /**
     * Emits once the read is no longer in flight, whether it arrived, failed or found no token.
     *
     * A caller that answers a question rather than drawing a screen needs this: a signal read taken
     * while the request is still out reports an empty history, which is a different answer.
     */
    settled$,
    /** Reads it again, for a user who has just logged the week they want it to learn from. */
    reload: () => revision.update((count) => count + 1),
  };
});

export const injectRecurringPatterns = /* @__PURE__ */ toInjectFn(RECURRING_PATTERNS_DEF);
