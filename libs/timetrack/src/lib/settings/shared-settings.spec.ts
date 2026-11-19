import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { StandIn } from '../model/stand-in';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';
import { parseTimetrackSettings } from './parse';
import {
  PeerSharedSettings,
  encodeSharedSettings,
  mapSharedSettings,
  parseSharedSettings,
  sharedSettingsEntriesOf,
  stampSharedSettings,
  withPeerSharedSettings,
} from './shared-settings';

const TANK_KEYS = { '/home/human/dev/fifa': 'gitlab.com/ethlete/fifa' };
const MAC_KEYS = { '/Users/human/dev/fifa': 'gitlab.com/ethlete/fifa' };
const CREATED = new Date('2026-11-17T09:00:00Z');

const standIn = (overrides: Partial<StandIn> = {}): StandIn => ({
  id: 'stand-in:1:fifa',
  name: 'Standings rework',
  state: 'open',
  days: ['2026-11-17'],
  author: 'user',
  createdAt: CREATED,
  ...overrides,
});

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'repo:/home/human/dev/fifa@feat/standings#1',
  repoPath: '/home/human/dev/fifa',
  branch: 'feat/standings',
  target: { kind: 'stand-in', standInId: 'stand-in:1:fifa' },
  author: 'app',
  createdAt: CREATED,
  ...overrides,
});

const settingsWith = (change: Partial<TimetrackSettings>): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  ...change,
});

const stamped = (options: { before?: TimetrackSettings; after: Partial<TimetrackSettings>; atMs: number }) => {
  const before = options.before ?? DEFAULT_TIMETRACK_SETTINGS;

  return stampSharedSettings({ before, after: { ...before, ...options.after }, atMs: options.atMs });
};

const wireOf = (settings: TimetrackSettings, ownKeys: Record<string, string> = TANK_KEYS) =>
  encodeSharedSettings(sharedSettingsEntriesOf({ settings, ownKeys }));

const sent = (options: {
  settings: TimetrackSettings;
  clockOffsetMs?: number;
  peerKeys?: Record<string, string>;
  localKeys?: Record<string, string>;
}): PeerSharedSettings => {
  const parsed = parseSharedSettings(wireOf(options.settings, options.peerKeys ?? TANK_KEYS));

  if (!parsed) throw new Error('unparsable');

  return {
    entries: mapSharedSettings({
      entries: parsed,
      peerKeys: options.peerKeys ?? TANK_KEYS,
      localKeys: options.localKeys ?? MAC_KEYS,
    }),
    clockOffsetMs: options.clockOffsetMs ?? 0,
  };
};

describe('shared settings', () => {
  it('shows a rule and its stand-in made on one machine on the peer, in the peer checkout', () => {
    const tank = stamped({ after: { attributionRules: [rule()], standIns: [standIn()] }, atMs: 1_000 });
    const mac = withPeerSharedSettings({ settings: DEFAULT_TIMETRACK_SETTINGS, peers: [sent({ settings: tank })] });

    expect(mac.standIns).toEqual([standIn()]);
    expect(mac.attributionRules).toEqual([
      rule({ id: 'repo:/Users/human/dev/fifa@feat/standings#1', repoPath: '/Users/human/dev/fifa' }),
    ]);
    expect(JSON.stringify(mac)).not.toContain('/home/human');
    expect(mac.sharedStamps).toEqual({
      'rule:repo:/Users/human/dev/fifa@feat/standings#1': { atMs: 1_000 },
      'stand-in:stand-in:1:fifa': { atMs: 1_000 },
    });
  });

  it('lets the later edit win after the clock offset, a tie keeping the local one', () => {
    const base = settingsWith({ standIns: [standIn()] });
    const tank = stamped({ before: base, after: { standIns: [standIn({ name: 'Tank name' })] }, atMs: 5_000 });
    const mac = stamped({ before: base, after: { standIns: [standIn({ name: 'Mac name' })] }, atMs: 4_000 });

    expect(withPeerSharedSettings({ settings: mac, peers: [sent({ settings: tank })] }).standIns[0]?.name).toBe(
      'Tank name',
    );
    expect(withPeerSharedSettings({ settings: mac, peers: [sent({ settings: tank, clockOffsetMs: 1_000 })] })).toBe(
      mac,
    );
    expect(withPeerSharedSettings({ settings: mac, peers: [sent({ settings: tank, clockOffsetMs: 2_000 })] })).toBe(
      mac,
    );
  });

  it('removes a deleted stand-in on the peer and ignores an older copy of it', () => {
    const tank = stamped({ after: { standIns: [standIn()] }, atMs: 1_000 });
    const mac = withPeerSharedSettings({ settings: DEFAULT_TIMETRACK_SETTINGS, peers: [sent({ settings: tank })] });
    const removed = stamped({ before: tank, after: { standIns: [] }, atMs: 2_000 });
    const after = withPeerSharedSettings({ settings: mac, peers: [sent({ settings: removed })] });

    expect(after.standIns).toEqual([]);
    expect(after.sharedStamps?.['stand-in:stand-in:1:fifa']).toEqual({ atMs: 2_000, deleted: true });
    expect(withPeerSharedSettings({ settings: after, peers: [sent({ settings: tank })] })).toBe(after);
  });

  it('never re-stamps an echo, and stamps only what changed', () => {
    const tank = stamped({ after: { standIns: [standIn()] }, atMs: 1_000 });
    const mac = withPeerSharedSettings({ settings: DEFAULT_TIMETRACK_SETTINGS, peers: [sent({ settings: tank })] });
    const echo = sent({ settings: mac, peerKeys: MAC_KEYS, localKeys: TANK_KEYS });

    expect(withPeerSharedSettings({ settings: tank, peers: [echo] })).toBe(tank);

    const unrelated = { ...tank, dayTargetMs: tank.dayTargetMs + 1 };

    expect(stampSharedSettings({ before: tank, after: unrelated, atMs: 9_000 })).toBe(unrelated);
  });

  it('keeps the days this machine drew a stand-in on when it takes the peer version', () => {
    const tank = stamped({ after: { standIns: [standIn({ days: ['2026-11-17'], name: 'Later' })] }, atMs: 2_000 });
    const mac = settingsWith({
      standIns: [standIn({ days: ['2026-11-18'], heldOn: ['feat/x'] })],
      sharedStamps: { 'stand-in:stand-in:1:fifa': { atMs: 1_000 } },
    });
    const after = withPeerSharedSettings({ settings: mac, peers: [sent({ settings: tank })] });

    expect(after.standIns[0]).toMatchObject({ name: 'Later', days: ['2026-11-17', '2026-11-18'], heldOn: ['feat/x'] });
  });

  it('drops a rule of a repository the receiver has no checkout of, and a stand-in loses that checkout', () => {
    const tank = stamped({
      after: { attributionRules: [rule()], standIns: [standIn({ openedFor: '/home/human/dev/fifa' })] },
      atMs: 1_000,
    });
    const mac = withPeerSharedSettings({
      settings: DEFAULT_TIMETRACK_SETTINGS,
      peers: [sent({ settings: tank, localKeys: {} })],
    });

    expect(mac.attributionRules).toEqual([]);
    expect(mac.standIns).toEqual([standIn()]);
  });

  it('sends no credential and no machine path outside a keyed checkout', () => {
    const secret = '/home/human/dev/secret-client';
    const tank = stamped({
      after: {
        jira: { ...DEFAULT_TIMETRACK_SETTINGS.jira, email: 'human@example.com', host: 'jira.example.com' },
        attributionRules: [
          rule(),
          rule({ id: `repo:${secret}@main#2`, repoPath: secret, branch: 'main' }),
          rule({ id: 'rule-app', repoPath: undefined, branch: undefined, appId: 'slack' }),
        ],
        standIns: [
          {
            ...standIn({ openedFor: secret, openedForBranch: 'main', resolvedRuleIds: [`repo:${secret}@main#2`] }),
            token: 'glpat-secret',
          } as StandIn,
        ],
      },
      atMs: 1_000,
    });
    const wire = wireOf(tank);

    expect(wire).not.toContain('secret');
    expect(wire).not.toContain('example.com');
    expect(wire).toContain('slack');
    expect(wire).toContain('/home/human/dev/fifa');

    const forged = parseSharedSettings(
      JSON.stringify({
        sharedSettings: 1,
        entries: [
          { id: 'stand-in:x', atMs: 1, kind: 'stand-in', standIn: { ...standIn({ id: 'x' }), openedFor: secret } },
        ],
      }),
    );
    const mapped = mapSharedSettings({ entries: forged ?? [], peerKeys: TANK_KEYS, localKeys: MAC_KEYS });

    expect(JSON.stringify(mapped)).not.toContain('secret');
  });

  it('keeps its stamps through the stored settings', () => {
    const tank = stamped({ after: { standIns: [standIn()] }, atMs: 1_000 });
    const read = parseTimetrackSettings(JSON.parse(JSON.stringify(tank)));

    expect(read.sharedStamps).toEqual({ 'stand-in:stand-in:1:fifa': { atMs: 1_000 } });
  });
});
