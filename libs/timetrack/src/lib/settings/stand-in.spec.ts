import { describe, expect, it } from 'vitest';
import { AttributionRule, standInIdOf } from '../model/attribution';
import { StandIn } from '../model/stand-in';
import { DEFAULT_TIMETRACK_SETTINGS } from './model';
import { reopenStandIn, resolveStandIn, withStandIn, withStandInDay, withoutStandIn } from './stand-in';

const standIn = (overrides: Partial<StandIn> = {}): StandIn => ({
  id: 'stand-in-1',
  name: 'Competition Journey',
  state: 'open',
  days: [],
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/home/tom/dev/ea-frontend',
  target: { kind: 'stand-in', standInId: 'stand-in-1' },
  author: 'user',
  createdAt: new Date('2026-09-14T00:00:00.000Z'),
  ...overrides,
});

const settingsWith = (options: { standIns?: StandIn[]; rules?: AttributionRule[] } = {}) => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  standIns: options.standIns ?? [standIn()],
  attributionRules: options.rules ?? [rule()],
});

describe('withStandIn', () => {
  it('replaces the record with the same id', () => {
    const settings = withStandIn({ settings: settingsWith(), standIn: standIn({ name: 'Journey' }) });

    expect(settings.standIns).toHaveLength(1);
    expect(settings.standIns[0]?.name).toBe('Journey');
  });
});

describe('withoutStandIn', () => {
  it('takes the rules that named it with it', () => {
    const settings = withoutStandIn({
      settings: settingsWith({ rules: [rule(), rule({ id: 'rule-2', target: { kind: 'donate' } })] }),
      id: 'stand-in-1',
    });

    expect(settings.standIns).toEqual([]);
    expect(settings.attributionRules.map((entry) => entry.id)).toEqual(['rule-2']);
  });
});

describe('resolveStandIn', () => {
  it('points every rule that named it at the issue', () => {
    const settings = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'fip-100' });

    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
    expect(settings.standIns[0]?.state).toBe('resolved');
    expect(settings.standIns[0]?.issueKey).toBe('FIP-100');
  });

  it('leaves a rule that named another stand-in alone', () => {
    const other = rule({ id: 'rule-2', target: { kind: 'stand-in', standInId: 'stand-in-2' } });
    const settings = resolveStandIn({
      settings: settingsWith({ rules: [rule(), other] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });

    expect(standInIdOf(settings.attributionRules[1]!)).toBe('stand-in-2');
  });

  it('changes nothing for an id nothing holds', () => {
    const settings = settingsWith();

    expect(resolveStandIn({ settings, id: 'stand-in-2', issueKey: 'FIP-100' })).toBe(settings);
  });

  it('changes nothing when no issue is named', () => {
    const settings = settingsWith();

    expect(resolveStandIn({ settings, id: 'stand-in-1', issueKey: '  ' })).toBe(settings);
  });
});

describe('reopenStandIn', () => {
  it('points the rules it rewrote back at the stand-in', () => {
    const resolved = resolveStandIn({ settings: settingsWith(), id: 'stand-in-1', issueKey: 'FIP-100' });
    const settings = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'stand-in', standInId: 'stand-in-1' });
    expect(settings.standIns[0]?.state).toBe('open');
    expect(settings.standIns[0]?.issueKey).toBeUndefined();
  });

  it('leaves a rule the user wrote against the same issue alone', () => {
    const own = rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-100' } });
    const resolved = resolveStandIn({
      settings: settingsWith({ rules: [rule(), own] }),
      id: 'stand-in-1',
      issueKey: 'FIP-100',
    });
    const settings = reopenStandIn({ settings: resolved, id: 'stand-in-1' });

    expect(settings.attributionRules[1]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-100' });
  });

  it('changes nothing for a stand-in that is still open', () => {
    const settings = settingsWith();

    expect(reopenStandIn({ settings, id: 'stand-in-1' })).toBe(settings);
  });
});

describe('withStandInDay', () => {
  it('records the day once', () => {
    const once = withStandInDay({ settings: settingsWith(), id: 'stand-in-1', day: '2026-09-14' });
    const twice = withStandInDay({ settings: once, id: 'stand-in-1', day: '2026-09-14' });

    expect(twice.standIns[0]?.days).toEqual(['2026-09-14']);
  });
});
