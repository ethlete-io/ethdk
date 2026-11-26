import { AttributionRule } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { toApiAttributionRule } from './agent-rules';

const rule = (over: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/repo/a',
  target: { kind: 'issue', issueKey: 'FIP-1' },
  author: 'user',
  createdAt: new Date(5),
  ...over,
});

describe('toApiAttributionRule', () => {
  it('keeps the day a rule is scoped to', () => {
    expect(toApiAttributionRule(rule({ day: '2025-11-18' })).day).toBe('2025-11-18');
  });

  it('leaves the day out of a rule that holds on every day', () => {
    expect(toApiAttributionRule(rule()).day).toBeUndefined();
  });
});
