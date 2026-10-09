import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import {
  FORGE_READ_MAX_WINDOW_MS,
  FORGE_READ_OVERLAP_MS,
  collectGitHubEvents$,
  collectGitLabEvents$,
} from '@ethlete/timetrack';
import { of } from 'rxjs';
import { HOST_PORTS, HostPorts, SourceTally } from '../host';
import { injectGitHubCollector } from './github-collector';
import { injectGitLabCollector } from './gitlab-collector';

vi.mock('@ethlete/core', () => ({
  defineRootProvider: <T>(factory: () => T) => factory,
  toInjectFn: <T>(factory: () => T) => factory,
}));

vi.mock('../app/collection-pause', () => ({ injectCollectionPause: () => ({ isPaused: () => false }) }));

vi.mock('../app/settings/settings', () => ({
  injectTimetrackSettings: () => ({
    ready$: of(undefined),
    settings: () => ({
      gitlab: { host: 'git.example.com' },
      github: { enabled: true },
      keepDefaultExclusionRules: false,
      exclusionRules: [],
    }),
  }),
}));

vi.mock('@ethlete/timetrack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ethlete/timetrack')>()),
  probeForgeAuth$: vi.fn(() =>
    of({
      cli: 'glab',
      state: 'logged-in',
      logins: [
        { host: 'git.example.com', login: 'tom' },
        { host: 'github.com', login: 'tom' },
      ],
    }),
  ),
  collectGitLabEvents$: vi.fn(() => of({ events: [], failures: [] })),
  collectGitHubEvents$: vi.fn(() => of({ events: [], failures: [] })),
}));

const NOW = new Date('2026-10-09T12:00:00.000Z');

const start = (inject: () => unknown, tallies: SourceTally[]) => {
  const events = { bySource$: () => of(tallies), appendCounted$: () => of(0) };
  const injector = createEnvironmentInjector(
    [{ provide: HOST_PORTS, useValue: { events, processes: {} } as unknown as HostPorts }],
    Injector.NULL as EnvironmentInjector,
  );

  runInInjectionContext(injector, inject);
  vi.advanceTimersByTime(0);
  injector.destroy();
};

const readOf = (collect: typeof collectGitLabEvents$ | typeof collectGitHubEvents$) =>
  vi.mocked(collect).mock.calls[0]?.[0];

describe('forge collectors', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    vi.mocked(collectGitLabEvents$).mockClear();
    vi.mocked(collectGitHubEvents$).mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('resumes GitLab a day before its newest stored event on the first run after a restart', () => {
    const latestAt = new Date('2026-10-09T08:00:00.000Z');

    start(injectGitLabCollector, [
      { source: 'gitlab', count: 12, latestAt },
      { source: 'github', count: 3, latestAt: new Date('2026-09-01T08:00:00.000Z') },
    ]);

    expect(readOf(collectGitLabEvents$)).toMatchObject({
      from: new Date(latestAt.getTime() - FORGE_READ_OVERLAP_MS),
      to: NOW,
      coveredThrough: latestAt,
    });
  });

  it('resumes GitHub a day before its newest stored event on the first run after a restart', () => {
    const latestAt = new Date('2026-10-08T20:00:00.000Z');

    start(injectGitHubCollector, [
      { source: 'gitlab', count: 12, latestAt: new Date('2026-10-09T11:00:00.000Z') },
      { source: 'github', count: 3, latestAt },
    ]);

    expect(readOf(collectGitHubEvents$)).toMatchObject({
      from: new Date(latestAt.getTime() - FORGE_READ_OVERLAP_MS),
      to: NOW,
      coveredThrough: latestAt,
    });
  });

  it('reads thirty days when nothing of the source is stored', () => {
    start(injectGitLabCollector, [{ source: 'git', count: 40, latestAt: new Date('2026-10-09T11:00:00.000Z') }]);

    expect(readOf(collectGitLabEvents$)).toMatchObject({
      from: new Date(NOW.getTime() - FORGE_READ_MAX_WINDOW_MS),
      coveredThrough: null,
    });
  });
});
