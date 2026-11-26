import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { collectGitEvents$ } from '@ethlete/timetrack';
import { Observable, of } from 'rxjs';
import { HOST_PORTS, HostPorts } from '../host';
import {
  GIT_GROUP_RESCAN_GAP_MS,
  GIT_RECONCILE_GAP_MS,
  GIT_WATCH_POLL_INTERVAL_MS,
  injectGitCollector,
} from './git-collector';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

vi.mock('../app/collection-pause', () => ({ injectCollectionPause: () => ({ isPaused: () => false }) }));

vi.mock('../app/settings/settings', () => ({
  injectTimetrackSettings: () => ({
    ready$: of(undefined),
    settings: () => ({ gitScanRoots: ['/dev'], knownWorktrees: {}, repoAliases: {} }),
    rememberWorktrees: () => undefined,
  }),
}));

vi.mock('@ethlete/timetrack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ethlete/timetrack')>()),
  readRepoKey$: () => of(null),
  collectGitEvents$: vi.fn(() => of({ events: [], failures: [] })),
}));

const MAIN = '/dev/main';
const LINKED = ['/dev/main-a', '/dev/main-b'];
const LONE = ['/dev/one', '/dev/two'];

const porcelain = (cwd: string) =>
  cwd === MAIN || LINKED.includes(cwd)
    ? [MAIN, ...LINKED].map((path) => `worktree ${path}\nHEAD abc\nbranch refs/heads/x\n`).join('\n')
    : `worktree ${cwd}\nHEAD abc\nbranch refs/heads/x\n`;

const start = (changes$: (afterSeq: number) => Observable<{ repos: string[]; seq: number }>) => {
  const ports = {
    git: {
      repos$: () => of({ repos: [MAIN, ...LINKED, ...LONE], skipped: [] }),
      changes$,
    },
    processes: {
      run$: (spec: { args: string[]; cwd: string }) =>
        of({
          code: 0,
          stdout: spec.args[0] === 'worktree' ? porcelain(spec.cwd) : 'me@example.com',
          stderr: '',
        }),
    },
    events: { appendCounted$: () => of(0) },
    peers: { setRepoKeys$: () => of(undefined) },
  } as unknown as HostPorts;
  const injector = createEnvironmentInjector(
    [{ provide: HOST_PORTS, useValue: ports }],
    Injector.NULL as EnvironmentInjector,
  );

  runInInjectionContext(injector, injectGitCollector);

  return injector;
};

const scanned = () =>
  vi.mocked(collectGitEvents$).mock.calls.map(([options]) => ({
    at: Date.now(),
    paths: options.repos.map((repo) => repo.path).sort(),
  }));

describe('git collector', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-09T12:00:00.000Z') });
    vi.mocked(collectGitEvents$).mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('spreads the reconcile sweep over its checkout groups instead of scanning them back to back', async () => {
    const times: number[] = [];

    vi.mocked(collectGitEvents$).mockImplementation(() => {
      times.push(Date.now());

      return of({ events: [], failures: [] });
    });

    const injector = start(() => of({ repos: [], seq: 0 }));

    await vi.advanceTimersByTimeAsync(GIT_RECONCILE_GAP_MS * 4);
    injector.destroy();

    expect(times).toHaveLength(3);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(GIT_RECONCILE_GAP_MS);
    expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(GIT_RECONCILE_GAP_MS);
  });

  it('scans a checkout group once for a run of moves that reach every worktree', async () => {
    vi.mocked(collectGitEvents$).mockImplementation(() => of({ events: [], failures: [] }));

    let seq = 0;
    const injector = start(() => of({ repos: [MAIN, ...LINKED], seq: ++seq }));

    await vi.advanceTimersByTimeAsync(GIT_RECONCILE_GAP_MS * 4);

    const afterSweep = vi.mocked(collectGitEvents$).mock.calls.length;

    await vi.advanceTimersByTimeAsync(GIT_WATCH_POLL_INTERVAL_MS * 7);
    injector.destroy();

    const moves = scanned().slice(afterSweep);

    expect(moves.length).toBeLessThanOrEqual(Math.ceil((GIT_WATCH_POLL_INTERVAL_MS * 7) / GIT_GROUP_RESCAN_GAP_MS));
    expect(moves.every((move) => move.paths.join() === [MAIN, ...LINKED].sort().join())).toBe(true);
  });
});
