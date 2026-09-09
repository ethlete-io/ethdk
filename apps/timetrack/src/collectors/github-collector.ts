import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ForgeAuth,
  GITHUB_HOST,
  applyExclusionRules,
  collectGitHubEvents$,
  effectiveExclusionRules,
  forgeLoginFor,
  probeForgeAuth$,
} from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, defer, exhaustMap, of, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';

/** The same interval GitLab uses. Review activity belongs to a day that is reviewed at its end. */
export const GITHUB_POLL_INTERVAL_MS = 10 * 60_000;

export const GITHUB_WINDOW_MS = 26 * 60 * 60_000;

/**
 * What the first run of a session asks for. GitHub's feed stops at 300 events whatever this says, so a
 * run that cannot reach the whole month reports how far it got rather than reaching silently short.
 */
export const GITHUB_FIRST_WINDOW_MS = 30 * 24 * 60 * 60_000;

export type GitHubCollectorRun = {
  at: Date;
  seen: number;
  stored: number;
  /** Pull requests a run could not read, and the feed's cap when it cut the window short. */
  failures: string[];
  excluded: number;
};

/**
 * Reads the user's own GitHub pull request activity into the event store, beside GitLab's.
 *
 * It reads through `gh`, which holds its own login, so this app stores no GitHub token. The switch in
 * settings is off by default: an account-wide feed has to be asked for, not inherited from having the
 * binary installed.
 */
const GITHUB_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<GitHubCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const auth = signal<ForgeAuth | null>(null);
  let read = false;

  const read$ = (login: string): Observable<unknown> => {
    const at = new Date();
    const windowMs = read ? GITHUB_WINDOW_MS : GITHUB_FIRST_WINDOW_MS;

    return collectGitHubEvents$({
      runner: ports.processes,
      login,
      from: new Date(at.getTime() - windowMs),
      to: at,
    }).pipe(
      concatMap((collection) => {
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
          if (!settings.settings().github.enabled) return of(undefined);

          return probeForgeAuth$({ runner: ports.processes, cli: 'gh' }).pipe(
            tap((probed) => auth.set(probed)),
            switchMap((probed) => {
              const login = forgeLoginFor(probed, GITHUB_HOST);

              return login ? read$(login.login) : of(undefined);
            }),
          );
        }),
        tap({ complete: () => failure.set(null) }),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  timer(0, GITHUB_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? EMPTY : collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, failure, auth };
});

export const injectGitHubCollector = /* @__PURE__ */ toInjectFn(GITHUB_COLLECTOR_DEF);
