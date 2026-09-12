import { computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { TempoHistory, fetchTempoHistory$, readJiraCredentials$, readTempoCredentials$ } from '@ethlete/timetrack';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';

const NOTHING: TempoHistory = { patterns: [], loggedIssues: [] };

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
 * reading exactly as it did before this was here.
 */
const RECURRING_PATTERNS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();

  const revision = signal(0);

  const read = toSignal(
    toObservable(revision).pipe(
      switchMap(() =>
        combineLatest({
          jira: readJiraCredentials$({ secrets: ports.secrets, settings: settings.settings() }),
          tempo: readTempoCredentials$({ secrets: ports.secrets }),
        }).pipe(
          switchMap(({ jira, tempo }) =>
            jira && tempo ? fetchTempoHistory$({ transport: ports.transport, jira, tempo }) : of(NOTHING),
          ),
          catchError(() => of(NOTHING)),
        ),
      ),
    ),
    { initialValue: NOTHING },
  );

  return {
    patterns: computed(() => read().patterns),
    /** Every issue the last weeks logged against, most recently logged first. */
    loggedIssues: computed(() => read().loggedIssues),
    /** Reads it again, for a user who has just logged the week they want it to learn from. */
    reload: () => revision.update((count) => count + 1),
  };
});

export const injectRecurringPatterns = /* @__PURE__ */ toInjectFn(RECURRING_PATTERNS_DEF);
