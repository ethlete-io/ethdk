import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import {
  withAttributionRule,
  withRepointedAttributionRules,
  withReplacedAttributionRule,
  withoutAttributionRule,
} from './attribution';
import { DEFAULT_TIMETRACK_SETTINGS } from './model';

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/Users/tom/dev/ea-frontend',
  target: { kind: 'issue', issueKey: 'FIP-100' },
  author: 'user',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const settingsWith = (rules: AttributionRule[]) => ({ ...DEFAULT_TIMETRACK_SETTINGS, attributionRules: rules });

describe('withAttributionRule', () => {
  it('replaces the rule that named the same context', () => {
    const settings = withAttributionRule({
      settings: settingsWith([rule()]),
      rule: rule({ id: 'rule-2', target: { kind: 'issue', issueKey: 'FIP-200' } }),
    });

    expect(settings.attributionRules).toHaveLength(1);
    expect(settings.attributionRules[0]?.target).toEqual({ kind: 'issue', issueKey: 'FIP-200' });
  });

  it('keeps a branch rule beside the repository rule it sits inside', () => {
    const settings = withAttributionRule({
      settings: settingsWith([rule()]),
      rule: rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-200' } }),
    });

    expect(settings.attributionRules.map((entry) => entry.id)).toEqual(['rule-1', 'rule-2']);
  });
});

describe('withoutAttributionRule', () => {
  it('removes the rule by id', () => {
    const settings = withoutAttributionRule({ settings: settingsWith([rule()]), id: 'rule-1' });

    expect(settings.attributionRules).toEqual([]);
  });
});

describe('withReplacedAttributionRule', () => {
  it('writes the new rule and drops the one it stands in for, in one value', () => {
    const donating = rule({ id: 'rule-1', branch: 'next', target: { kind: 'donate' } });
    const settings = withReplacedAttributionRule({
      settings: settingsWith([donating]),
      rule: rule({ id: 'rule-2', branch: undefined, target: { kind: 'issue', issueKey: 'ET-772' } }),
      supersededIds: ['rule-1'],
    });

    expect(settings.attributionRules.map((entry) => entry.id)).toEqual(['rule-2']);
  });

  it('writes the rule on its own when nothing is superseded', () => {
    const settings = withReplacedAttributionRule({
      settings: settingsWith([rule({ id: 'rule-1', branch: 'next' })]),
      rule: rule({ id: 'rule-2', branch: undefined, target: { kind: 'issue', issueKey: 'ET-772' } }),
    });

    expect(settings.attributionRules.map((entry) => entry.id)).toEqual(['rule-1', 'rule-2']);
  });
});

describe('withRepointedAttributionRules', () => {
  const rules = [
    rule({ id: 'a', target: { kind: 'issue', issueKey: 'FIFAGG-12069' } }),
    rule({ id: 'b', repoPath: '/Users/human/dev/other', target: { kind: 'issue', issueKey: 'FIFAGG-12069' } }),
    rule({ id: 'c', target: { kind: 'issue', issueKey: 'FIP-100' } }),
    rule({ id: 'd', target: { kind: 'stand-in', standInId: 'stand-in:1' } }),
  ];

  it('points every rule naming the old issue at the new one and leaves the rest alone', () => {
    const { settings, repointedIds } = withRepointedAttributionRules({
      settings: settingsWith(rules),
      from: 'FIFAGG-12069',
      to: 'FIFAGG-12769',
    });

    expect(repointedIds).toEqual(['a', 'b']);
    expect(settings.attributionRules.map((entry) => [entry.id, entry.target])).toEqual([
      ['a', { kind: 'issue', issueKey: 'FIFAGG-12769' }],
      ['b', { kind: 'issue', issueKey: 'FIFAGG-12769' }],
      ['c', { kind: 'issue', issueKey: 'FIP-100' }],
      ['d', { kind: 'stand-in', standInId: 'stand-in:1' }],
    ]);
    expect(settings.attributionRules[0]?.createdAt).toEqual(rules[0]?.createdAt);
  });

  it('limits the rewrite to one checkout', () => {
    const { repointedIds } = withRepointedAttributionRules({
      settings: settingsWith(rules),
      from: 'FIFAGG-12069',
      to: 'FIFAGG-12769',
      repoPath: '/Users/human/dev/other',
    });

    expect(repointedIds).toEqual(['b']);
  });

  it('answers the same settings when no rule names the old issue', () => {
    const before = settingsWith(rules);
    const { settings, repointedIds } = withRepointedAttributionRules({ settings: before, from: 'X-1', to: 'X-2' });

    expect(repointedIds).toEqual([]);
    expect(settings).toBe(before);
  });
});
