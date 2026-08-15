import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { WorkGroup } from './merge';
import { AttributionRule, describeAttributionRule, issueKeyOf, matchAttributionRule, unnamedContexts } from './rules';

const rule = (overrides: Partial<AttributionRule> = {}): AttributionRule => ({
  id: 'rule-1',
  repoPath: '/Users/tom/dev/ea-frontend',
  target: { kind: 'issue', issueKey: 'FIP-100' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const block = (context: ActivityBlock['context'], from: string, to: string): ActivityBlock => ({
  from: new Date(from),
  to: new Date(to),
  context,
  evidence: [],
});

const group = (blocks: ActivityBlock[]): WorkGroup => ({
  from: blocks[0]?.from ?? new Date(0),
  to: blocks[blocks.length - 1]?.to ?? new Date(0),
  observedMs: 0,
  confidence: 'weak',
  evidence: [],
  blocks,
});

describe('matchAttributionRule', () => {
  it('matches a repository rule against any branch of it', () => {
    const match = matchAttributionRule({
      context: { repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' },
      rules: [rule()],
    });

    expect(match?.scope).toBe('repo');
    expect(issueKeyOf(match!.rule)).toBe('FIP-100');
  });

  it('prefers the branch rule over the repository rule it sits inside', () => {
    const match = matchAttributionRule({
      context: { repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' },
      rules: [rule(), rule({ id: 'rule-2', branch: 'next', target: { kind: 'issue', issueKey: 'FIP-200' } })],
    });

    expect(match?.scope).toBe('branch');
    expect(issueKeyOf(match!.rule)).toBe('FIP-200');
  });

  it('reads a ref and a plain branch name as the same branch', () => {
    const match = matchAttributionRule({
      context: { repoPath: '/Users/tom/dev/ea-frontend', branch: 'refs/heads/next' },
      rules: [rule({ branch: 'next', target: { kind: 'issue', issueKey: 'FIP-200' } })],
    });

    expect(issueKeyOf(match!.rule)).toBe('FIP-200');
  });

  it('does not let a branch rule match a different branch of the same repository', () => {
    const match = matchAttributionRule({
      context: { repoPath: '/Users/tom/dev/ea-frontend', branch: 'chore/cleanup' },
      rules: [rule({ branch: 'next', target: { kind: 'issue', issueKey: 'FIP-200' } })],
    });

    expect(match).toBeUndefined();
  });

  it('matches an app rule only when the block has no repository of its own', () => {
    const rules = [
      rule({
        id: 'rule-3',
        repoPath: undefined,
        appId: 'com.tinyspeck.slackmacgap',
        target: { kind: 'issue', issueKey: 'FIP-300' },
      }),
    ];

    expect(issueKeyOf(matchAttributionRule({ context: { appId: 'com.tinyspeck.slackmacgap' }, rules })!.rule)).toBe(
      'FIP-300',
    );
    expect(matchAttributionRule({ context: { appId: 'com.google.Chrome' }, rules })).toBeUndefined();
  });

  it('takes the newest of two rules that are equally specific', () => {
    const match = matchAttributionRule({
      context: { repoPath: '/Users/tom/dev/ea-frontend' },
      rules: [
        rule(),
        rule({
          id: 'rule-2',
          target: { kind: 'issue', issueKey: 'FIP-400' },
          createdAt: new Date('2026-08-10T00:00:00Z'),
        }),
      ],
    });

    expect(issueKeyOf(match!.rule)).toBe('FIP-400');
  });
});

describe('unnamedContexts', () => {
  it('folds the day fragments of one context into a single question', () => {
    const context = { repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' };
    const contexts = unnamedContexts({
      unattributed: [
        group([block(context, '2026-08-11T08:00:00Z', '2026-08-11T09:00:00Z')]),
        group([block(context, '2026-08-11T13:00:00Z', '2026-08-11T14:30:00Z')]),
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.observedMs).toBe(150 * 60_000);
    expect(contexts[0]?.from).toEqual(new Date('2026-08-11T08:00:00Z'));
    expect(contexts[0]?.to).toEqual(new Date('2026-08-11T14:30:00Z'));
    expect(contexts[0]?.suggestion).toEqual({ repoPath: context.repoPath, branch: 'next' });
  });

  it('orders the contexts by how much time is waiting on an answer', () => {
    const contexts = unnamedContexts({
      unattributed: [
        group([block({ appId: 'com.google.Chrome' }, '2026-08-11T08:00:00Z', '2026-08-11T08:20:00Z')]),
        group([
          block(
            { repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' },
            '2026-08-11T09:00:00Z',
            '2026-08-11T12:00:00Z',
          ),
        ]),
      ],
    });

    expect(contexts.map((entry) => entry.context.repoPath ?? entry.context.appId)).toEqual([
      '/Users/tom/dev/ea-frontend',
      'com.google.Chrome',
    ]);
  });

  it('leaves out a group with no context at all, such as a meeting', () => {
    expect(unnamedContexts({ unattributed: [group([])] })).toEqual([]);
  });
});

describe('describeAttributionRule', () => {
  it('names a branch rule by repository and branch', () => {
    expect(describeAttributionRule(rule({ branch: 'next' }))).toBe('ea-frontend @ next');
  });

  it('names a repository rule by the repository alone', () => {
    expect(describeAttributionRule(rule())).toBe('ea-frontend');
  });
});
