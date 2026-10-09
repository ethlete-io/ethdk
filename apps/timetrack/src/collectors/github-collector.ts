import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  ForgeAuth,
  GITHUB_HOST,
  applyExclusionRules,
  collectMergeRequestChanges$,
  collectGitHubEvents$,
  effectiveExclusionRules,
  forgeLoginFor,
  forgeReadWindow,
  probeForgeAuth$,
} from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, defer, exhaustMap, map, of, switchMap, tap, timer } from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { injectHostPorts } from '../host';
import { injectGitCollector } from './git-collector';

/** The same interval GitLab uses. Review activity belongs to a day that is reviewed at its end. */
export const GITHUB_POLL_INTERVAL_MS = 10 * 60_000;

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
  const git = injectGitCollector();
  const settings = injectTimetrackSettings();
  const pause = injectCollectionPause();
  const lastRun = signal<GitHubCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const auth = signal<ForgeAuth | null>(null);

  const read$ = (login: string): Observable<unknown> => {
    const at = new Date();

    return ports.events.bySource$().pipe(
      map((tallies) =>
        forgeReadWindow({ at, newestStored: tallies.find((tally) => tally.source === 'github')?.latestAt ?? null }),
      ),
      concatMap((span) => collectGitHubEvents$({ runner: ports.processes, login, ...span })),
      concatMap((collection) => {
        const { kept, excluded } = applyExclusionRules({
          events: collection.events,
          rules: effectiveExclusionRules(settings.settings()),
        });

        return ports.events.appendCounted$(kept).pipe(
          concatMap((stored) =>
            collectMergeRequestChanges$({ processes: ports.processes, events: kept, repoKeys: git.remoteKeys() }).pipe(
              concatMap((changes) => ports.events.appendCounted$(changes)),
              map(() => stored),
            ),
          ),
          tap((stored) => {
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
