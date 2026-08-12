import { signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { GitRepoScan, GitScanFailure, collectGitEvents$ } from '@ethlete/timetrack';
import { EMPTY, Observable, catchError, concatMap, defer, exhaustMap, from, map, of, tap, timer, toArray } from 'rxjs';
import { injectTimetrackSettings } from '../app/settings/settings';
import { GitRepoDiscovery, injectHostPorts } from '../host';

/**
 * How often the host is asked which repositories moved. This is not the scan interval — it is how
 * long a branch switch waits before it is read, and asking costs a counter read rather than a
 * process.
 */
export const GIT_WATCH_POLL_INTERVAL_MS = 5_000;

/** How often every repository is scanned regardless of the watch, so a missed notification heals. */
export const GIT_RECONCILE_INTERVAL_MS = 10 * 60_000;

/** How often the machine is walked again, so a repository cloned since the app started is picked up. */
export const GIT_DISCOVER_INTERVAL_MS = 60 * 60_000;

/**
 * How far back an ordinary scan reads. Wide enough to cover yesterday evening's work when the app is
 * started this morning, and safe to overlap because the store drops what it already has by dedupe key.
 */
export const GIT_SCAN_WINDOW_MS = 26 * 60 * 60_000;

/**
 * How far back the first scan of a session reads, so a machine the app was closed on for a fortnight
 * still reconstructs those days. It matches the raw-event retention window: reading past it would
 * collect events the next retention pass deletes.
 */
export const GIT_FIRST_SCAN_WINDOW_MS = 30 * 24 * 60 * 60_000;

export type GitCollectorRun = {
  at: Date;
  repos: number;
  /** Events the scan produced, including the ones the store already had. */
  seen: number;
  /** Events that were new. Zero is the normal result of a reconcile that found nothing had changed. */
  stored: number;
  failures: GitScanFailure[];
};

type Repo = { path: string; author?: string };

/**
 * Reads the branch switches and commits out of the repositories on this machine.
 *
 * Two cadences drive it: the host's watch names a repository whose HEAD or refs moved, which is
 * scanned within seconds, and every repository is scanned again on a slower timer so a notification
 * that never arrived costs latency rather than a hole. Both read a window of history rather than a
 * stream, so they overlap by design — `dedupeKeyOf` is what keeps that from appending a commit twice.
 */
const GIT_COLLECTOR_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const lastRun = signal<GitCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const discovery = signal<GitRepoDiscovery | null>(null);

  let repos: Repo[] = [];
  let afterSeq = 0;
  let discoveredAt = 0;
  let discoveredRoots: string | null = null;
  let reconciledAt = 0;
  let scannedOnce = false;

  /**
   * The identity commits are restricted to, per repository: a work checkout and a personal one are
   * often two different addresses, and the wrong one silently collects nobody's commits.
   */
  const author$ = (path: string): Observable<Repo> =>
    ports.processes.run$({ command: 'git', args: ['config', '--get', 'user.email'], cwd: path }).pipe(
      map((result) => (result.code === 0 && result.stdout.trim() ? { path, author: result.stdout.trim() } : { path })),
      catchError(() => of({ path })),
    );

  const discover$ = (): Observable<Repo[]> =>
    ports.git.repos$(settings.settings().gitScanRoots).pipe(
      tap((found) => discovery.set(found)),
      concatMap((found) => from(found.repos).pipe(concatMap(author$), toArray())),
      tap((found) => (repos = found)),
    );

  const scan$ = (paths: string[]): Observable<unknown> => {
    const at = new Date();
    const windowMs = scannedOnce ? GIT_SCAN_WINDOW_MS : GIT_FIRST_SCAN_WINDOW_MS;
    const scans = repos
      .filter((repo) => paths.includes(repo.path))
      .map((repo): GitRepoScan => ({
        path: repo.path,
        window: { from: new Date(at.getTime() - windowMs), to: at },
        ...(repo.author ? { author: repo.author } : {}),
      }));

    if (!scans.length) return EMPTY;

    return collectGitEvents$({ processes: ports.processes, repos: scans }).pipe(
      concatMap((scan) =>
        ports.events.appendWithCursors$(scan.events, []).pipe(
          tap((stored) => {
            scannedOnce = true;
            failure.set(null);
            lastRun.set({ at, repos: scans.length, seen: scan.events.length, stored, failures: scan.failures });
          }),
        ),
      ),
    );
  };

  const moved$ = (): Observable<unknown> =>
    ports.git.changes$(afterSeq).pipe(
      tap((changes) => (afterSeq = changes.seq)),
      concatMap((changes) => (changes.repos.length ? scan$(changes.repos) : EMPTY)),
    );

  /**
   * Nothing is discovered before the settings have been read, and a change to the roots discovers again
   * rather than waiting for the hourly walk — a directory somebody just named has to be scanned now.
   */
  const collect$ = (): Observable<unknown> =>
    defer(() =>
      settings.ready$.pipe(
        concatMap(() => {
          const now = Date.now();
          const roots = settings.settings().gitScanRoots.join('\n');
          const discovering = roots !== discoveredRoots || now - discoveredAt >= GIT_DISCOVER_INTERVAL_MS;
          const reconciling = now - reconciledAt >= GIT_RECONCILE_INTERVAL_MS;

          if (discovering) {
            discoveredAt = now;
            discoveredRoots = roots;
          }

          if (reconciling) reconciledAt = now;

          const discovered$ = discovering ? discover$() : of(repos);

          return discovered$.pipe(concatMap(() => (reconciling ? scan$(repos.map((repo) => repo.path)) : moved$())));
        }),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  timer(0, GIT_WATCH_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => collect$()),
      takeUntilDestroyed(),
    )
    .subscribe();

  return { lastRun, failure, discovery };
});

export const injectGitCollector = /* @__PURE__ */ toInjectFn(GIT_COLLECTOR_DEF);
