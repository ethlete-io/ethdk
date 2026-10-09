import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { DEFAULT_EXCLUSION_RULES } from '../store/exclusion';
import { mergeDayEvents } from './merge-day-events';
import { streamDay } from './stream-day';

const SDK = '/home/tom/dev/ethlete-sdk';
const FUT = '/home/tom/dev/fut-frontend';
const MAC_SDK = '/Users/tom/code/ethlete-sdk';
const MAC_FUT = '/Users/tom/code/fut-frontend';
const MAC = { machineId: 'mac-id', machineName: 'MacBook' };
const OWN_KEYS = { [SDK]: 'gitlab.com/ethlete/sdk', [FUT]: 'gitlab.com/ethlete/fut' };
const MAC_KEYS = { [MAC_SDK]: 'gitlab.com/ethlete/sdk', [MAC_FUT]: 'gitlab.com/ethlete/fut' };

const AT = (minutes: number) => new Date(new Date(2026, 9, 8, 9, 0, 0).getTime() + minutes * 60_000);

const focusRun = (options: { from: number; to: number; appId: string; title: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'window' as const,
    kind: 'window-focus' as const,
    appId: options.appId,
    title: options.title,
  }));

const sessionRun = (options: { from: number; to: number; cwd: string; sessionId: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session' as const,
    kind: 'agent-session' as const,
    sessionId: options.sessionId,
    cwd: options.cwd,
    gitBranch: 'next',
  }));

const commit = (minutes: number, repoPath: string, sha: string): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch: 'next',
  sha,
  subject: `feat: ${sha}`,
});

const dayOf = (options: {
  local?: CollectedEvent[];
  mac: CollectedEvent[];
  links?: TimetrackProjectLink[];
  rules?: typeof DEFAULT_EXCLUSION_RULES;
}) =>
  streamDay({
    events: mergeDayEvents({
      local: options.local ?? [],
      received: {
        events: options.mac.map((event) => ({ ...MAC, event })),
        repoKeys: { [MAC.machineId]: MAC_KEYS },
      },
      keys: OWN_KEYS,
      rules: options.rules ?? [],
    }),
    options: { repoRoots: [SDK, FUT], links: options.links },
  });

const rowsIn = (day: ReturnType<typeof streamDay>, laneKey: string) =>
  [...day.rows.proposals, ...day.rows.unnamed].filter((row) => row.laneKey === laneKey);

describe('streamDay over a paired machine’s events', () => {
  it('shows the work done only on the paired machine as attended rows of the local checkout', () => {
    const day = dayOf({
      mac: [...focusRun({ from: 0, to: 120, appId: 'code', title: 'ethlete-sdk - Code' }), commit(60, MAC_SDK, 'a1')],
    });

    expect(day.presenceMs).toBe(120 * 60_000);
    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${SDK}`]);
    expect(rowsIn(day, `repo:${SDK}`).length).toBeGreaterThan(0);
    expect(rowsIn(day, `repo:${SDK}`).every((row) => !('unattended' in row && row.unattended))).toBe(true);
    expect(day.peerLanes[MAC.machineId]?.[`repo:${SDK}`]).toEqual([{ from: AT(0), to: AT(120) }]);
  });

  it('keeps a block on this machine whole while the paired machine’s focus moves', () => {
    const day = dayOf({
      local: focusRun({ from: 0, to: 60, appId: 'code', title: 'fut-frontend - Code' }),
      mac: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'ethlete-sdk - Code' }),
        ...focusRun({ from: 21, to: 40, appId: 'firefox', title: 'News' }),
        ...focusRun({ from: 41, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
    });
    const fut = day.blocks.filter((block) => block.context.repoPath === FUT);

    expect(fut.map((block) => [block.from, block.to])).toEqual([[AT(0), AT(60)]]);
    expect(day.presenceMs).toBe(60 * 60_000);
    expect(day.engagedMs).toBeGreaterThan(day.presenceMs);
    expect(rowsIn(day, `repo:${FUT}`).length).toBeGreaterThan(0);
    expect(rowsIn(day, `repo:${SDK}`).length).toBeGreaterThan(0);
  });

  it('counts one checkout worked on both machines at once once', () => {
    const day = dayOf({
      local: focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
      mac: focusRun({ from: 30, to: 90, appId: 'code', title: 'ethlete-sdk - Code' }),
    });

    expect(day.blocks.map((block) => [block.from, block.to])).toEqual([[AT(0), AT(90)]]);
    expect(day.presenceMs).toBe(90 * 60_000);
  });

  it('draws no break where only one machine was away', () => {
    const day = dayOf({
      local: [
        ...focusRun({ from: 0, to: 60, appId: 'code', title: 'fut-frontend - Code' }),
        ...focusRun({ from: 120, to: 180, appId: 'code', title: 'fut-frontend - Code' }),
      ],
      mac: focusRun({ from: 55, to: 125, appId: 'code', title: 'ethlete-sdk - Code' }),
    });

    expect(day.breaks).toEqual([]);
  });

  it('keeps "Worked on" on a band of this machine the paired machine’s work does not explain', () => {
    const day = dayOf({
      local: sessionRun({ from: 0, to: 60, cwd: FUT, sessionId: 'night' }),
      mac: focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
    });

    expect(rowsIn(day, `repo:${FUT}`)[0]).toMatchObject({ unattended: true, workedOn: 'MacBook' });
    expect(rowsIn(day, `repo:${SDK}`)[0]).not.toHaveProperty('unattended');
  });

  it('applies this machine’s private project link to the paired machine’s events', () => {
    const day = dayOf({
      mac: [
        ...focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(30, MAC_SDK, 'secret'),
        ...sessionRun({ from: 0, to: 60, cwd: MAC_SDK, sessionId: 'private-session' }),
      ],
      links: [{ id: 'private-sdk', path: SDK, target: { kind: 'private' }, createdAt: AT(0) }],
    });
    const shown = JSON.stringify({
      streams: day.streams,
      blocks: day.blocks,
      rows: day.rows,
      unnamed: day.unnamedFocus,
    });

    expect(day.presenceMs).toBe(60 * 60_000);
    expect(day.streams.some((stream) => stream.repoPath === SDK)).toBe(false);
    expect(day.unnamedFocus).toEqual([{ appId: 'code', reason: 'private', ms: 60 * 60_000, titles: [] }]);
    expect(shown).not.toContain('ethlete-sdk');
    expect(shown).not.toContain('secret');
  });

  it('applies this machine’s exclusion rules to the paired machine’s events', () => {
    const day = dayOf({
      mac: [
        ...focusRun({ from: 0, to: 30, appId: 'org.keepassxc.KeePassXC', title: 'Vault - KeePassXC' }),
        ...focusRun({ from: 31, to: 60, appId: 'firefox', title: 'Acme client portal' }),
        ...focusRun({ from: 61, to: 90, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
      rules: [...DEFAULT_EXCLUSION_RULES, { kind: 'title-pattern', pattern: 'acme' }],
    });
    const shown = JSON.stringify(day);

    expect(shown).not.toContain('KeePassXC');
    expect(shown).not.toContain('Vault');
    expect(shown).not.toContain('Acme');
    expect(rowsIn(day, `repo:${SDK}`).length).toBeGreaterThan(0);
  });

  describe('spend and agent time across both machines', () => {
    const turn = (minutes: number, cwd: string, turnId: string): CollectedEvent => ({
      at: AT(minutes),
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: 'claude-code',
      sessionId: `session-${turnId}`,
      turnId,
      cwd,
      model: 'claude-opus',
      usage: { input: 10, output: 100, cacheWrite: 0, cacheRead: 1_000, thinking: 0 },
    });

    it('splits the spend of a checkout by the machine that ran each turn', () => {
      const day = dayOf({
        local: [...focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }), turn(10, SDK, 'here')],
        mac: [turn(20, MAC_SDK, 'mac-1'), turn(30, MAC_SDK, 'mac-2')],
      });
      const sdk = day.streams.find((stream) => stream.key === `repo:${SDK}`);
      const share = { machineId: MAC.machineId, machineName: MAC.machineName, turns: 2 };

      expect(sdk?.spend.turns).toBe(3);
      expect(sdk?.spend.peers).toEqual([expect.objectContaining(share)]);
      expect(sdk?.spend.peers?.[0]?.usage.output).toBe(200);
      expect(day.spend.turns).toBe(3);
      expect(day.spend.peers).toEqual([expect.objectContaining(share)]);
      expect(day.spendTurns.map((spent) => spent.turnId).sort()).toEqual(['here', 'mac-1', 'mac-2']);
    });

    it('counts a turn both machines hold once, and leaves a day of this machine’s turns without a split', () => {
      const day = dayOf({
        local: [...focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }), turn(20, SDK, 'shared')],
        mac: [turn(20, MAC_SDK, 'shared')],
      });

      expect(day.spend.turns).toBe(1);
      expect(day.spend.peers).toBeUndefined();
    });

    it('reads no agent time as alone while a person was at the paired machine', () => {
      const day = dayOf({
        local: [
          ...focusRun({ from: 0, to: 5, appId: 'code', title: 'fut-frontend - Code' }),
          { at: AT(6), source: 'idle', kind: 'idle-start' },
          ...sessionRun({ from: 6, to: 60, cwd: FUT, sessionId: 'left-running' }),
        ],
        mac: focusRun({ from: 30, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
      });
      const fut = day.streams.find((stream) => stream.key === `repo:${FUT}`);

      expect(fut?.unattendedMs).toBe(24 * 60_000);
      expect(day.unattendedMs).toBe(24 * 60_000);
    });
  });

  describe('attendance across both machines', () => {
    const input = (minutes: number, kind: 'input-active' | 'input-idle'): CollectedEvent => ({
      at: AT(minutes),
      source: 'input',
      kind,
    });

    const idle = (minutes: number, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
      at: AT(minutes),
      source: 'idle',
      kind,
    });

    const prompt = (minutes: number): CollectedEvent => ({
      at: AT(minutes),
      source: 'agent-prompt',
      kind: 'agent-prompt',
      provider: 'claude-code',
      sessionId: 'remote',
      promptId: `prompt-${minutes}`,
      cwd: FUT,
      askedBy: 'human',
    });

    it('does not read a prompt typed at the paired machine as phone time here', () => {
      const day = dayOf({
        local: [
          input(0, 'input-active'),
          ...focusRun({ from: 0, to: 30, appId: 'code', title: 'fut-frontend - Code' }),
          input(29, 'input-idle'),
          idle(30, 'idle-start'),
          ...[45, 60, 75].flatMap((minutes) => [
            ...sessionRun({ from: minutes, to: minutes, cwd: FUT, sessionId: 'remote' }),
            prompt(minutes),
          ]),
          idle(100, 'idle-end'),
          input(100, 'input-active'),
          ...focusRun({ from: 100, to: 130, appId: 'code', title: 'fut-frontend - Code' }),
        ],
        mac: [
          input(0, 'input-idle'),
          input(30, 'input-active'),
          ...focusRun({ from: 30, to: 100, appId: 'code', title: 'ethlete-sdk - Code' }),
        ],
      });
      const [atTheMac] = rowsIn(day, `repo:${SDK}`);

      expect(atTheMac?.durationMs).toBe(75 * 60_000);
    });

    it('lets the grace of this machine reach a band where only this machine was away', () => {
      const day = dayOf({
        local: [
          ...focusRun({ from: 0, to: 10, appId: 'code', title: 'fut-frontend - Code' }),
          idle(11, 'idle-start'),
          ...[15, 30, 45, 60, 75].flatMap((minutes) =>
            sessionRun({ from: minutes, to: minutes, cwd: FUT, sessionId: 'left-running' }),
          ),
          idle(90, 'idle-end'),
          ...focusRun({ from: 90, to: 100, appId: 'code', title: 'fut-frontend - Code' }),
        ],
        mac: focusRun({ from: 11, to: 89, appId: 'code', title: 'ethlete-sdk - Code' }),
      });

      expect(rowsIn(day, `repo:${FUT}`).filter((row) => 'unattended' in row && row.unattended)).toEqual([]);
    });
  });
});
