import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ForgeAuth,
  applyExclusionRules,
  collectGitLabEvents$,
  effectiveExclusionRules,
  forgeHostname,
  forgeLoginFor,
  probeForgeAuth$,
} from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, defer, exhaustMap, of, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';

/**
 * How often GitLab is asked again. Review activity is not urgent — the day it belongs to is reviewed
 * at its end — and every read costs the instance a page of events plus a merge request or two.
 */
export const GITLAB_POLL_INTERVAL_MS = 10 * 60_000;

/** How far a run reaches back. Wide enough that yesterday evening is still in it. */
export const GITLAB_WINDOW_MS = 26 * 60 * 60_000;

/** What the first run of a session reaches back over, so a week the app was closed still arrives. */
export const GITLAB_FIRST_WINDOW_MS = 30 * 24 * 60 * 60_000;

export type GitLabCollectorRun = {
  at: Date;
  /** Events the read produced, including the ones the store already had. */
  seen: number;
  stored: number;
  /** Merge requests a run could not read. The events are stored without a branch. */
  failures: string[];
  /** Events a title rule denied. A merge request is named after the work, like everything else. */
  excluded: number;
};

/**
 * Reads the user's own GitLab activity into the event store, so reviewing somebody else's merge
 * request reaches `correlateDay` through the same path as a commit.
 *
 * It reads through `glab`, which holds its own credential, so this app stores no GitLab token. That
 * moves the two ways the source can go quiet — the binary leaving the `PATH`, and the login expiring —
 * out of the keychain and into `auth`, which the Sources row reports as two distinct states.
 *
 * Every read overlaps the last one, and `dedupeKeyOf` keys each event by GitLab's own id — which is
 * what lets the first run of a session reach back a month without storing anything twice.
 */
const GITLAB_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<GitLabCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const auth = signal<ForgeAuth | null>(null);
  let read = false;

  const read$ = (hostname: string): Observable<unknown> => {
    const at = new Date();
    const windowMs = read ? GITLAB_WINDOW_MS : GITLAB_FIRST_WINDOW_MS;

    return collectGitLabEvents$({
      runner: ports.processes,
      hostname,
      from: new Date(at.getTime() - windowMs),
      to: at,
    }).pipe(
      concatMap((collection) => {
        // A merge request title is named after the work, so a title rule applies to it exactly as it
        // applies to a window title — the same argument as an agent session's own title.
        const { kept, excluded } = applyExclusionRules({
          events: collection.events,
          rules: effectiveExclusionRules(settings.settings()),
        });

        return ports.events.appendCounted$(kept).pipe(
          tap((stored) => {
            read = true;
            lastRun.set({
              at,
              seen: collection.events.length,
              stored,
              failures: collection.failures,
              excluded: excluded.length,
            });
          }),
        );
      }),
    );
  };

  const collect$ = (): Observable<unknown> =>
    defer(() =>
      settings.ready$.pipe(
        concatMap(() => {
          const { host } = settings.settings().gitlab;

          if (!host) return of(undefined);

          return probeForgeAuth$({ runner: ports.processes, cli: 'glab' }).pipe(
            tap((probed) => auth.set(probed)),
            switchMap((probed) => (forgeLoginFor(probed, host) ? read$(forgeHostname(host)) : of(undefined))),
          );
        }),
        // A run that throws never completes, so this is the one owner of clearing the failure. Doing
        // it in the success `tap` instead left the banner up for good in every run that stores
        // nothing: no host and no login both short-circuit before that `tap` is ever reached.
        tap({ complete: () => failure.set(null) }),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  // A paused collector asks GitLab nothing. A run reaches over a day either way, so the store refuses
  // the events that fall inside the pause once collection comes back.
  timer(0, GITLAB_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, failure, auth };
});

export const injectGitLabCollector = /* @__PURE__ */ toInjectFn(GITLAB_COLLECTOR_DEF);
