import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { mergeDayEvents } from './merge-day-events';
import { streamDay } from './stream-day';

const MINUTE = 60_000;
const DAY_START = new Date(2026, 10, 19, 0, 0, 0);
const AT = (minute: number) => new Date(DAY_START.getTime() + minute * MINUTE);
const REPO = '/home/human/dev/ethlete-sdk';
const KEYS = { [REPO]: 'gitlab.com/ethlete/sdk' };
const SESSION = 'night-session';
const TANK = { machineId: 'tank-id', machineName: 'tank' };
const MAC = { machineId: 'mac-id', machineName: 'MacBook' };

const minutes = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => from + offset);

const tank: CollectedEvent[] = [
  ...[...minutes(0, 15), ...minutes(660, 700)].map((minute): CollectedEvent => ({
    at: AT(minute),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'stream-day.ts - ethlete-sdk - Code',
  })),
  { at: AT(20), source: 'idle', kind: 'idle-start' },
  { at: AT(660), source: 'idle', kind: 'idle-end' },
  {
    at: AT(5),
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: 'claude-code',
    sessionId: SESSION,
    promptId: 'prompt-5',
    cwd: REPO,
    gitBranch: 'next',
    askedBy: 'human',
  },
  ...minutes(0, 600).flatMap((minute): CollectedEvent[] => [
    {
      at: AT(minute),
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: SESSION,
      cwd: REPO,
      gitBranch: 'next',
    },
    {
      at: AT(minute),
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: 'claude-code',
      sessionId: SESSION,
      turnId: `msg-${minute}`,
      cwd: REPO,
      gitBranch: 'next',
      model: 'claude-opus-5',
      usage: { input: 3, output: 900, cacheWrite: 200, cacheRead: 60_000, thinking: 100 },
    },
  ]),
];

const mac: CollectedEvent[] = [
  { at: AT(22), source: 'input', kind: 'input-idle' },
  { at: AT(65), source: 'idle', kind: 'idle-start' },
];

const rowsOn = (options: {
  local: CollectedEvent[];
  peer?: { machineId: string; machineName: string; events: CollectedEvent[] };
}) => {
  const peer = options.peer;
  const day = streamDay({
    events: mergeDayEvents({
      local: options.local,
      received: {
        events: peer
          ? peer.events.map((event) => ({ machineId: peer.machineId, machineName: peer.machineName, event }))
          : [],
        repoKeys: peer ? { [peer.machineId]: KEYS } : {},
      },
      keys: KEYS,
      rules: [],
    }),
    options: { repoRoots: [REPO] },
  });

  return [...day.rows.proposals, ...day.rows.unnamed].map((row) => ({
    from: row.from.toISOString(),
    to: row.to.toISOString(),
    laneKey: row.laneKey,
    unattended: 'unattended' in row && !!row.unattended,
  }));
};

describe('an agent night on one of two paired machines', () => {
  const alone = rowsOn({ local: tank });

  it('stays unattended on the machine that ran it', () => {
    expect(alone.some((row) => row.unattended)).toBe(true);
  });

  it('draws the same rows on the peer that only received it', () => {
    expect(rowsOn({ local: mac, peer: { ...TANK, events: tank } })).toEqual(alone);
  });

  it('is not attended by a peer that went idle during it', () => {
    expect(rowsOn({ local: tank, peer: { ...MAC, events: mac } })).toEqual(alone);
  });
});
