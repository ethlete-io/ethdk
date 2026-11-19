import '@angular/compiler';
import {
  CollectedEvent,
  DEFAULT_TIMETRACK_SETTINGS,
  GIT_FIELD_SEPARATOR,
  ProcessSpec,
  ReceivedBranchTimelines,
} from '@ethlete/timetrack';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { HostPorts, HostReceivedRange } from '../host';
import { readDay$ } from './read-day';

const DAY = '2026-11-18';
const KEY = 'gitlab.com/client/shop';
const TANK = 'tank';
const TANK_CHECKOUT = '/home/you/dev/shop';
const TANK_WORKTREE = '/home/you/dev/shop-wt/hotfix';
const MAC_CHECKOUT = '/Users/you/dev/shop';
const AT = (minutes: number) => new Date(Date.UTC(2026, 10, 18, 9, 0, 0) + minutes * 60_000);

const sessions = (cwd: string): CollectedEvent[] =>
  Array.from({ length: 61 }, (_, index) => ({
    at: AT(index),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: 'session',
    cwd,
  }));

const macReflog = [
  `HEAD@{2026-11-10T09:00:00+01:00}${GIT_FIELD_SEPARATOR}checkout: moving from next to feature/mac-only`,
].join('\n');

const received = (events: CollectedEvent[]): HostReceivedRange => ({
  events: events.map((event) => ({ machineId: TANK, machineName: 'tank', event })),
  repoKeys: { [TANK]: { [TANK_CHECKOUT]: KEY, [TANK_WORKTREE]: KEY } },
  ownRepoKeys: { [MAC_CHECKOUT]: KEY },
  dayRows: [],
});

const tankTimelines: ReceivedBranchTimelines[] = [
  {
    machineId: TANK,
    checkouts: [
      {
        key: KEY,
        windows: [
          { fromMs: 0, branch: 'main' },
          { fromMs: Date.UTC(2026, 10, 17, 8, 0, 0), branch: 'next' },
        ],
      },
    ],
  },
];

const portsOf = (options: { local: CollectedEvent[]; peer: CollectedEvent[]; asked: string[] }) =>
  ({
    events: { eventsBetween$: () => of(options.local) },
    review: { editsFor$: () => of(null) },
    timers: { runsBetween$: () => of([]) },
    coverage: { forDay$: () => of(null) },
    transcription: { day$: () => of([]) },
    peers: {
      receivedBetween$: () => of(received(options.peer)),
      receivedBranchTimelines$: () => of(tankTimelines),
    },
    processes: {
      run$: (spec: ProcessSpec) => {
        options.asked.push(spec.cwd ?? '');

        return of({ code: 0, stdout: macReflog, stderr: '' });
      },
    },
  }) as unknown as HostPorts;

const branchesOf = async (options: { local: CollectedEvent[]; peer: CollectedEvent[] }) => {
  const asked: string[] = [];
  const read = await firstValueFrom(
    readDay$({
      ports: portsOf({ ...options, asked }),
      settings: DEFAULT_TIMETRACK_SETTINGS,
      repoRoots: [MAC_CHECKOUT],
      links: [],
      worktrees: {},
      dependencies: {},
      day: DAY,
    }),
  );

  return { branches: read.day.streams.find((stream) => stream.repoPath === MAC_CHECKOUT)?.branches, asked };
};

describe('a checkout only a paired machine worked in that day', () => {
  it('names the branch the paired machine was on, not the one this machine is on', async () => {
    const { branches, asked } = await branchesOf({ local: [], peer: sessions(TANK_CHECKOUT) });

    expect(branches).toEqual(['next']);
    expect(asked).toEqual([]);
  });

  it('folds work in a linked worktree there onto its main checkout', async () => {
    const { branches } = await branchesOf({ local: [], peer: sessions(TANK_WORKTREE) });

    expect(branches).toEqual(['next']);
  });

  it('keeps asking this machine for a checkout this machine worked in', async () => {
    const { branches, asked } = await branchesOf({ local: sessions(MAC_CHECKOUT), peer: [] });

    expect(branches).toEqual(['feature/mac-only']);
    expect(asked).toEqual([MAC_CHECKOUT]);
  });
});
