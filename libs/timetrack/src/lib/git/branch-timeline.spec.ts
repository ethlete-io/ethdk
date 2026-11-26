import { describe, expect, it } from 'vitest';
import {
  branchAtIn,
  branchWindowsIn,
  encodeBranchTimelines,
  parseBranchTimelines,
  peerHeadBranches,
  repoPathsOfEvents,
} from './branch-timeline';
import { CollectedEvent, OriginEvent } from '../model/event';
import { GIT_FIELD_SEPARATOR } from './format';
import { parseHeadBranchAt } from './head';

const checkout = (options: { stamp: string; from: string; to: string }) =>
  `HEAD@{${options.stamp}}${GIT_FIELD_SEPARATOR}checkout: moving from ${options.from} to ${options.to}`;

const OUTPUT = [
  checkout({ stamp: '2026-11-18T14:00:00+01:00', from: 'next', to: 'feature/report' }),
  checkout({ stamp: '2026-11-10T09:00:00+01:00', from: 'main', to: 'next' }),
  checkout({ stamp: '2026-09-01T09:00:00+02:00', from: 'release', to: 'main' }),
].join('\n');

describe('branchWindowsIn', () => {
  const windows = branchWindowsIn({ output: OUTPUT, since: new Date('2026-10-20T00:00:00Z') });

  it('keeps the window holding at the cutoff and every later one', () => {
    expect(windows.map((window) => window.branch)).toEqual(['main', 'next', 'feature/report']);
  });

  it('answers what the reflog answers for every instant after the cutoff', () => {
    for (const at of ['2026-10-21T12:00:00Z', '2026-11-18T10:00:00Z', '2026-11-18T23:00:00Z']) {
      expect(branchAtIn({ windows, at: new Date(at) })).toBe(parseHeadBranchAt({ output: OUTPUT, at: new Date(at) }));
    }
  });

  it('starts at the branch HEAD came from when the reflog holds no older switch', () => {
    const all = branchWindowsIn({ output: OUTPUT, since: new Date('2020-01-01T00:00:00Z') });

    expect(branchAtIn({ windows: all, at: new Date('2026-01-01T00:00:00Z') })).toBe('release');
  });
});

describe('parseBranchTimelines', () => {
  it('reads back what was encoded', () => {
    const checkouts = [{ key: 'gitlab.com/client/shop', windows: [{ fromMs: 0, branch: 'main' }, { fromMs: 5 }] }];

    expect(parseBranchTimelines(encodeBranchTimelines(checkouts))).toEqual(checkouts);
  });

  it('drops what no version wrote', () => {
    expect(
      parseBranchTimelines('{"checkouts":[{"key":"","windows":[]},{"key":"a","windows":[{"fromMs":"x"}]}]}'),
    ).toEqual([]);
    expect(parseBranchTimelines('not json')).toEqual([]);
  });
});

describe('peerHeadBranches', () => {
  const REPO = '/home/you/dev/app-a';
  const PEER = { machineId: 'peer-1', machineName: 'Peer' };
  const event = (minute: number, origin: 'local' | typeof PEER): OriginEvent => ({
    at: new Date(Date.UTC(2026, 10, 18, 8, minute)),
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: 'vscode',
    repoPath: REPO,
    editing: true,
    origin,
  });
  const timelines = [
    {
      machineId: 'peer-1',
      checkouts: [
        {
          key: 'app-a',
          windows: [{ fromMs: 0 }, { fromMs: Date.UTC(2026, 10, 18, 8, 30), branch: 'feature/abc-12-x' }],
        },
      ],
    },
  ];
  const read = (events: OriginEvent[]) =>
    peerHeadBranches({ events, repoPaths: [REPO], localKeys: { [REPO]: 'app-a' }, timelines });

  it('names a checkout both machines worked in after the peer where only the peer filled it', () => {
    expect(read([event(0, 'local'), event(45, PEER)])).toEqual({
      byMachine: { 'peer-1': { [REPO]: 'feature/abc-12-x' } },
      local: [REPO],
    });
  });

  it('answers the peer at its own first event, not at the end of the day', () => {
    expect(read([event(10, PEER), event(45, PEER)])).toEqual({ byMachine: {}, local: [REPO] });
  });

  it('leaves a checkout only the peer worked in to the peer', () => {
    expect(read([event(45, PEER)])).toEqual({
      byMachine: { 'peer-1': { [REPO]: 'feature/abc-12-x' } },
      local: [],
    });
  });
});

describe('repoPathsOfEvents', () => {
  it('lists each path the events name once', () => {
    const at = new Date('2026-11-18T10:00:00Z');
    const events = [
      { source: 'git', kind: 'git-checkout', at, repoPath: '/a', branch: 'x' },
      { source: 'git', kind: 'git-checkout', at, repoPath: '/a', branch: 'y' },
      { source: 'editor', kind: 'editor-heartbeat', at, reporter: 'vscode', directory: '/b' },
    ] as unknown as CollectedEvent[];

    expect(repoPathsOfEvents(events)).toEqual(['/a', '/b']);
  });
});
