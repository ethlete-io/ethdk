import { computed, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import {
  CheckoutKeys,
  CollectedEvent,
  GitRepoScan,
  GitScanFailure,
  collectGitEvents$,
  gitHasCommitArgs,
  gitWorktreeArgs,
  linkedWorktreesOf,
  mainOfDeletedCheckout,
  parseGitWorktrees,
  readRepoKey$,
  resolveLocalOrigins,
  unknownCommitCheckoutsOf,
  withRepoAliases,
} from '@ethlete/timetrack';
import {
  EMPTY,
  Observable,
  catchError,
  concatMap,
  defer,
  endWith,
  exhaustMap,
  from,
  ignoreElements,
  map,
  of,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { injectCollectionPause } from '../app/collection-pause';
import { injectTimetrackSettings } from '../app/settings/settings';
import { GitRepoDiscovery, injectHostPorts } from '../host';

const sameWorktrees = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([path, main]) => b[path] === main);

/**
 * How often the host is asked which repositories moved. This is not the scan interval — it is how
 * long a branch switch waits before it is read, and asking costs a counter read rather than a
 * process.
 */
export const GIT_WATCH_POLL_INTERVAL_MS = 5_000;

/** How often every repository is scanned regardless of the watch, so a missed notification heals. */
export const GIT_RECONCILE_INTERVAL_MS = 10 * 60_000;

/** The pause between two checkout groups of the reconcile sweep, so ~55 repositories are never read back to back. */
export const GIT_RECONCILE_GAP_MS = 1_000;

/**
 * How soon a checkout group, the main checkout and its linked worktrees, is rescanned after a move.
 * A move is reported for every worktree sharing the refs, so a run of commits would otherwise rescan the
 * whole group on every poll.
 */
export const GIT_GROUP_RESCAN_GAP_MS = 20_000;

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
  const pause = injectCollectionPause();
  const lastRun = signal<GitCollectorRun | null>(null);
  const failure = signal<string | null>(null);
  const discovery = signal<GitRepoDiscovery | null>(null);
  const liveWorktrees = signal<Readonly<Record<string, string>>>({});
  /** Every linked worktree mapped to its main checkout: the live ones and every one this machine saw before. */
  const worktrees = computed<Readonly<Record<string, string>>>(
    () => ({ ...settings.settings().knownWorktrees, ...liveWorktrees() }),
    { equal: sameWorktrees },
  );
  const probed = new Set<string>();
  /** Each checkout's key read from its remote, before an alias the user set replaces it. */
  const remoteKeys = signal<CheckoutKeys>({});

  let repos: Repo[] = [];
  let afterSeq = 0;
  let discoveredAt = 0;
  let discoveredRoots: string | null = null;
  let reconciledAt = 0;
  let scannedOnce = false;
  let keyedAliases: string | null = null;

  const aliasesNow = () => JSON.stringify(settings.settings().repoAliases);

  /**
   * The identity commits are restricted to, per repository: a work checkout and a personal one are
   * often two different addresses, and the wrong one silently collects nobody's commits.
   */
  const author$ = (path: string): Observable<Repo> =>
    ports.processes.run$({ command: 'git', args: ['config', '--get', 'user.email'], cwd: path }).pipe(
      map((result) => (result.code === 0 && result.stdout.trim() ? { path, author: result.stdout.trim() } : { path })),
      catchError(() => of({ path })),
    );

  const linkedOf$ = (path: string): Observable<Record<string, string>> =>
    ports.processes.run$({ command: 'git', args: gitWorktreeArgs(), cwd: path }).pipe(
      map((result) => (result.code === 0 ? linkedWorktreesOf(parseGitWorktrees(result.stdout)) : {})),
      catchError(() => of({})),
    );

  const writeRepoKeys$ = (found: Repo[]): Observable<unknown> =>
    from(found).pipe(
      concatMap((repo) =>
        readRepoKey$({ processes: ports.processes, repoPath: repo.path }).pipe(map((key) => [repo.path, key])),
      ),
      toArray(),
      concatMap((entries) => {
        const keys = resolveLocalOrigins(Object.fromEntries(entries));
        keyedAliases = aliasesNow();
        remoteKeys.set(keys);

        return ports.peers.setRepoKeys$(withRepoAliases({ keys, aliases: settings.settings().repoAliases }));
      }),
      catchError(() => of(null)),
    );

  const discover$ = (): Observable<Repo[]> =>
    ports.git.repos$(settings.settings().gitScanRoots).pipe(
      concatMap((found) =>
        from(found.repos).pipe(
          concatMap(linkedOf$),
          toArray(),
          // A reader that sees the repositories before their worktrees would file a worktree nowhere, or
          // under a root link, and an automatic stand-in opened then keeps that project.
          tap((linked) => {
            const live: Record<string, string> = Object.assign({}, ...linked);
            liveWorktrees.set(live);
            settings.rememberWorktrees(live);
            discovery.set(found);
          }),
          concatMap(() => from(found.repos).pipe(concatMap(author$), toArray())),
        ),
      ),
      tap((found) => (repos = found)),
      concatMap((found) => writeRepoKeys$(found).pipe(ignoreElements(), endWith(found))),
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
        ports.events.appendCounted$(scan.events).pipe(
          tap((stored) => {
            scannedOnce = true;
            failure.set(null);
            lastRun.set({ at, repos: scans.length, seen: scan.events.length, stored, failures: scan.failures });
          }),
        ),
      ),
    );
  };

  const groupOf = (path: string) => worktrees()[path] ?? path;

  const groupsOf = (paths: readonly string[]): string[][] => {
    const groups = new Map<string, string[]>();

    for (const path of paths) groups.set(groupOf(path), [...(groups.get(groupOf(path)) ?? []), path]);

    return [...groups.values()];
  };

  const pendingMoves = new Set<string>();
  const groupScannedAt = new Map<string, number>();

  const scanGroup$ = (paths: string[]): Observable<unknown> => {
    groupScannedAt.set(groupOf(paths[0] ?? ''), Date.now());

    return scan$(paths);
  };

  const moved$ = (): Observable<unknown> =>
    ports.git.changes$(afterSeq).pipe(
      tap((changes) => {
        afterSeq = changes.seq;

        for (const repo of changes.repos) pendingMoves.add(repo);
      }),
      concatMap(() => {
        const now = Date.now();
        const due = groupsOf([...pendingMoves]).filter(
          (paths) => now - (groupScannedAt.get(groupOf(paths[0] ?? '')) ?? 0) >= GIT_GROUP_RESCAN_GAP_MS,
        );

        for (const path of due.flat()) pendingMoves.delete(path);

        return from(due).pipe(concatMap(scanGroup$));
      }),
    );

  const reconcile$ = (): Observable<unknown> => {
    pendingMoves.clear();

    return from(groupsOf(repos.map((repo) => repo.path))).pipe(
      concatMap((paths, index) =>
        timer(index === 0 ? 0 : GIT_RECONCILE_GAP_MS).pipe(concatMap(() => scanGroup$(paths))),
      ),
    );
  };

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

          const rekeying = !discovering && keyedAliases !== null && keyedAliases !== aliasesNow();
          const discovered$ = discovering
            ? discover$()
            : rekeying
              ? writeRepoKeys$(repos).pipe(ignoreElements(), endWith(repos))
              : of(repos);

          return discovered$.pipe(concatMap(() => (reconciling ? reconcile$() : moved$())));
        }),
        catchError((error: unknown) => {
          failure.set(error instanceof Error ? error.message : String(error));

          return EMPTY;
        }),
      ),
    );

  const discoverWhilePaused$ = (): Observable<unknown> =>
    discovery()
      ? EMPTY
      : settings.ready$.pipe(
          concatMap(() => {
            discoveredAt = Date.now();
            discoveredRoots = settings.settings().gitScanRoots.join('\n');

            return discover$();
          }),
          catchError((error: unknown) => {
            failure.set(error instanceof Error ? error.message : String(error));

            return EMPTY;
          }),
        );

  /**
   * A paused collector scans no repository. What it would have found is refused by the store as well:
   * a scan reads a window of history, so the first one after a resume reaches back over the pause.
   * It still lists the repositories once, since the day is not drawn before that list is known.
   */
  timer(0, GIT_WATCH_POLL_INTERVAL_MS)
    .pipe(
      exhaustMap(() => (pause.isPaused() ? discoverWhilePaused$() : collect$())),
      takeUntilDestroyed(),
    )
    .subscribe();

  const hasCommit$ = (repo: string, sha: string) =>
    ports.processes.run$({ command: 'git', args: gitHasCommitArgs(sha), cwd: repo }).pipe(
      map((result) => result.code === 0),
      catchError(() => of(false)),
    );

  /**
   * Files a checkout that stored commits name but that no longer exists under the discovered repository
   * holding those commits, picked by `mainOfDeletedCheckout` when clones hold them too.
   */
  const learnDeletedWorktrees = (events: readonly CollectedEvent[]) => {
    const found = discovery();
    if (!found) return;

    const linked = worktrees();
    const mains = found.repos.filter((repo) => linked[repo] === undefined);
    const known = new Set([...found.repos, ...Object.keys(linked), ...probed]);
    const unknown = [...unknownCommitCheckoutsOf({ events, known })];

    if (!unknown.length) return;

    for (const [checkout] of unknown) probed.add(checkout);

    from(unknown)
      .pipe(
        concatMap(([checkout, sha]) =>
          from(mains).pipe(
            concatMap((main) => hasCommit$(main, sha).pipe(map((held) => (held ? main : null)))),
            toArray(),
            map((holders) => mainOfDeletedCheckout({ checkout, holders: holders.filter((main) => main !== null) })),
            map((main) => (main ? { [checkout]: main } : {})),
          ),
        ),
        toArray(),
        tap((filed) => settings.rememberWorktrees(Object.assign({}, ...filed))),
      )
      .subscribe();
  };

  return {
    lastRun,
    failure,
    discovery,
    worktrees,
    learnDeletedWorktrees,
    remoteKeys: remoteKeys.asReadonly(),
  };
});

export const injectGitCollector = /* @__PURE__ */ toInjectFn(GIT_COLLECTOR_DEF);
