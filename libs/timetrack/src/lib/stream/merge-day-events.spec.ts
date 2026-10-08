import { describe, expect, it } from 'vitest';
import { CollectedEvent, GitCommitEvent } from '../model/event';
import { ReceivedRange } from '../model/received-event';
import { mergeDayEvents } from './merge-day-events';

const SDK = 'gitlab.com/ethlete/sdk';
const LOCAL_SDK = '/home/tom/dev/ethlete-sdk';
const MAC_SDK = '/Users/tom/code/sdk';
const MAC = { machineId: 'mac-id', machineName: 'MacBook' };
const LAPTOP = { machineId: 'laptop-id', machineName: 'Laptop' };
const keys = { [LOCAL_SDK]: SDK };

const at = (hour: number, minute = 0) => new Date(2026, 9, 8, hour, minute);

const receivedFrom = (machine: typeof MAC, events: CollectedEvent[]): ReceivedRange => ({
  events: events.map((event) => ({ ...machine, event })),
  repoKeys: { [machine.machineId]: { [MAC_SDK]: SDK } },
});

const commit = (overrides: Partial<GitCommitEvent> = {}): GitCommitEvent => ({
  at: at(14),
  source: 'git',
  kind: 'git-commit',
  repoPath: LOCAL_SDK,
  branch: 'next',
  sha: 'abc',
  subject: 'feat: x',
  ...overrides,
});

const originsOf = (events: { origin: unknown }[]) =>
  events.map(({ origin }) => (origin === 'local' ? 'local' : (origin as typeof MAC).machineName));

describe('mergeDayEvents', () => {
  it('tags this machine’s events as local and leaves them as they are', () => {
    const window: CollectedEvent = { at: at(9), source: 'window', kind: 'window-focus', appId: 'code', title: 'x' };

    expect(mergeDayEvents({ local: [window], received: { events: [], repoKeys: {} }, keys })).toEqual([
      { ...window, origin: 'local' },
    ]);
  });

  it('maps a peer’s checkout paths onto the local checkout of the same repository', () => {
    const [mergedCommit, session, heartbeat] = mergeDayEvents({
      local: [],
      received: receivedFrom(MAC, [
        commit({ repoPath: MAC_SDK, worktree: `${MAC_SDK}/wt` }),
        {
          at: at(15),
          source: 'agent-session',
          kind: 'agent-session',
          sessionId: 's',
          cwd: MAC_SDK,
          workedIn: `${MAC_SDK}/libs/`,
        },
        {
          at: at(16),
          source: 'editor',
          kind: 'editor-heartbeat',
          reporter: 'vscode',
          repoPath: MAC_SDK,
          directory: 'libs/timetrack',
          editing: true,
        },
      ]),
      keys,
    });

    expect(mergedCommit).toMatchObject({ repoPath: LOCAL_SDK, worktree: `${LOCAL_SDK}/wt`, origin: MAC });
    expect(session).toMatchObject({ cwd: LOCAL_SDK, workedIn: `${LOCAL_SDK}/libs/` });
    expect(heartbeat).toMatchObject({ repoPath: LOCAL_SDK, directory: 'libs/timetrack' });
  });

  it('maps the whole-path directory of a heartbeat with no checkout', () => {
    const [heartbeat] = mergeDayEvents({
      local: [],
      received: receivedFrom(MAC, [
        {
          at: at(16),
          source: 'editor',
          kind: 'editor-heartbeat',
          reporter: 'vscode',
          directory: `${MAC_SDK}/docs`,
          editing: false,
        },
      ]),
      keys,
    });

    expect(heartbeat).toMatchObject({ directory: `${LOCAL_SDK}/docs` });
  });

  it('keeps a peer path no local checkout shares a repository with', () => {
    const [merged] = mergeDayEvents({
      local: [],
      received: receivedFrom(MAC, [commit({ repoPath: '/Users/tom/code/other' })]),
      keys,
    });

    expect(merged).toMatchObject({ repoPath: '/Users/tom/code/other' });
  });

  it('counts a calendar occurrence once, this machine’s copy first', () => {
    const meeting: CollectedEvent = {
      at: at(10),
      source: 'calendar',
      kind: 'calendar-event',
      occurrenceId: 'o1',
      until: at(11),
      title: 'Daily',
      accepted: true,
    };

    const merged = mergeDayEvents({ local: [meeting], received: receivedFrom(MAC, [meeting]), keys });

    expect(originsOf(merged)).toEqual(['local']);
  });

  it('counts a fact two peers hold once, the first peer’s copy', () => {
    const meeting: CollectedEvent = {
      at: at(10),
      source: 'calendar',
      kind: 'calendar-event',
      occurrenceId: 'o1',
      until: at(11),
      title: 'Daily',
      accepted: true,
    };
    const mac = receivedFrom(MAC, [meeting]);
    const laptop = receivedFrom(LAPTOP, [meeting]);

    const merged = mergeDayEvents({
      local: [],
      received: { events: [...mac.events, ...laptop.events], repoKeys: { ...mac.repoKeys, ...laptop.repoKeys } },
      keys,
    });

    expect(originsOf(merged)).toEqual(['MacBook']);
  });

  it('counts a merge-request event, a prompt and a turn once', () => {
    const shared: CollectedEvent[] = [
      {
        at: at(11),
        source: 'gitlab',
        kind: 'merge-request-activity',
        eventId: 'e1',
        action: 'approved',
      },
      {
        at: at(12),
        source: 'agent-prompt',
        kind: 'agent-prompt',
        provider: 'claude-code',
        sessionId: 's',
        promptId: 'p1',
        cwd: LOCAL_SDK,
      },
      {
        at: at(13),
        source: 'agent-usage',
        kind: 'agent-usage',
        provider: 'claude-code',
        sessionId: 's',
        turnId: 't1',
        cwd: LOCAL_SDK,
        model: 'm',
        usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, thinking: 0 },
      },
    ];

    const merged = mergeDayEvents({ local: shared, received: receivedFrom(MAC, shared), keys });

    expect(merged.map(({ kind }) => kind)).toEqual(['merge-request-activity', 'agent-prompt', 'agent-usage']);
    expect(originsOf(merged)).toEqual(['local', 'local', 'local']);
  });

  it('never folds a machine-local event across machines', () => {
    const local: CollectedEvent[] = [
      { at: at(9), source: 'window', kind: 'window-focus', appId: 'code', title: 'x' },
      { at: at(9), source: 'idle', kind: 'idle-start' },
      { at: at(9), source: 'idle', kind: 'lock' },
      { at: at(9), source: 'idle', kind: 'pause-start' },
      { at: at(9), source: 'input', kind: 'input-idle' },
      { at: at(9), source: 'call', kind: 'call-start', appId: 'zoom' },
      { at: at(9), source: 'editor', kind: 'editor-heartbeat', reporter: 'vscode', editing: false },
      { at: at(9), source: 'private', kind: 'private-interval' },
    ];

    const merged = mergeDayEvents({ local, received: receivedFrom(MAC, local), keys });

    expect(merged).toHaveLength(local.length * 2);
  });

  it('keeps the commit a peer wrote and this machine pulled on both machines (2026-10-08)', () => {
    const shas = Array.from({ length: 61 }, (_, index) => `sha${index}`);
    const written = shas.map((sha, index) => commit({ sha, repoPath: MAC_SDK, at: at(13, 36 + index) }));
    const pulled = shas.map((sha, index) => commit({ sha, at: at(19, 27), authoredAt: at(13, 36 + index) }));

    const merged = mergeDayEvents({ local: pulled, received: receivedFrom(MAC, written), keys });

    const onMac = merged.filter(({ origin }) => origin !== 'local');
    const onPc = merged.filter(({ origin }) => origin === 'local');

    expect(onMac).toHaveLength(61);
    expect(onPc).toHaveLength(61);
    expect(
      onMac.every((event) => event.kind === 'git-commit' && !event.authoredAt && event.repoPath === LOCAL_SDK),
    ).toBe(true);
    expect(onPc.every((event) => event.kind === 'git-commit' && event.at.getTime() === at(19, 27).getTime())).toBe(
      true,
    );
  });

  it('keeps one written copy of a commit, this machine’s first', () => {
    const merged = mergeDayEvents({
      local: [commit()],
      received: receivedFrom(MAC, [commit({ repoPath: MAC_SDK })]),
      keys,
    });

    expect(originsOf(merged)).toEqual(['local']);
  });

  it('keeps a commit written on two checkouts of this machine', () => {
    const merged = mergeDayEvents({
      local: [commit(), commit({ repoPath: '/home/tom/dev/ethlete-sdk-2' })],
      received: { events: [], repoKeys: {} },
      keys,
    });

    expect(merged).toHaveLength(2);
  });

  it('orders the merged list by instant', () => {
    const merged = mergeDayEvents({
      local: [commit({ sha: 'b', at: at(15) })],
      received: receivedFrom(MAC, [commit({ sha: 'a', at: at(14) })]),
      keys,
    });

    expect(merged.map((event) => event.at.getHours())).toEqual([14, 15]);
  });
});
