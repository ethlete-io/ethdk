import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { IssueActivity, attribute } from './attribute';
import { RecurringPattern } from './recurrence';
import { AttributionRule } from './rules';

const block = (context: ActivityBlock['context'], evidence: ActivityBlock['evidence'] = []): ActivityBlock => ({
  from: new Date('2026-08-11T08:00:00Z'),
  to: new Date('2026-08-11T09:00:00Z'),
  context,
  evidence,
});

/** Local-time, because a recurring pattern is matched on the local weekday and hour. */
const localBlock = (context: ActivityBlock['context'], evidence: ActivityBlock['evidence'] = []): ActivityBlock => ({
  from: new Date(2026, 7, 11, 10, 0),
  to: new Date(2026, 7, 11, 11, 0),
  context,
  evidence,
});

const mergeRequest = (overrides: Partial<IssueActivity> = {}): IssueActivity => ({
  kind: 'merge-request',
  issueKey: 'FIP-3010',
  at: new Date('2026-08-11T08:30:00Z'),
  branch: 'fix/logout-confirmation',
  detail: 'merge request !412 on `fix/logout-confirmation`',
  summary: 'Confirm before logging out',
  ...overrides,
});

const TUESDAY_PATTERN: RecurringPattern = {
  issueKey: 'FIP-9000',
  weekday: 2,
  fromMinute: 9 * 60 + 30,
  toMinute: 10 * 60 + 30,
  occurrences: 5,
};

const FIP = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });

const REPO_RULE: AttributionRule = {
  id: 'rule-repo',
  repoPath: '/Users/tom/dev/ea-frontend',
  target: { kind: 'issue', issueKey: 'FIP-100' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const BRANCH_RULE: AttributionRule = {
  ...REPO_RULE,
  id: 'rule-branch',
  branch: 'refactor/hub-query-v3',
  target: { kind: 'issue', issueKey: 'FIP-2904' },
};

describe('attribute', () => {
  it('is certain about a conforming main feature branch', () => {
    const result = attribute({ block: block({ branch: 'feat/FIP-2177-user-management' }), config: FIP });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.storyKey).toBe('FIP-2177');
    expect(result.confidence).toBe('certain');
  });

  it('logs a sub-feature against the task and keeps the story for roll-up', () => {
    const result = attribute({
      block: block({ branch: 'sub/feat/FIP-2177-user-management/FIP-2178-user-password-reset' }),
      config: FIP,
    });

    expect(result.issueKey).toBe('FIP-2178');
    expect(result.storyKey).toBe('FIP-2177');
    expect(result.taskKey).toBe('FIP-2178');
    expect(result.confidence).toBe('certain');
  });

  it('drops to likely when the branch names a key but does not conform', () => {
    const result = attribute({ block: block({ branch: 'feature/FIP-2177-user-management' }), config: FIP });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('likely');
  });

  it('inherits the story through the base branch and says so in the evidence', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: FIP,
      resolveBase: () => 'feat/FIP-2177-user-management',
    });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.map((entry) => entry.kind)).toContain('inherited-branch');
  });

  it('falls back to a key in a window title, weakly', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: '[FIP-2222] Button not visible - Jira' },
      ]),
      config: FIP,
    });

    expect(result.issueKey).toBe('FIP-2222');
    expect(result.confidence).toBe('weak');
  });

  it('ignores a title key from another project when keyPrefixes is set', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: 'ABC-99 something else' },
      ]),
      config: FIP,
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('leaves a block with no key at all unattributed rather than guessing', () => {
    const result = attribute({ block: block({ appId: 'slack' }), config: FIP });

    expect(result.issueKey).toBeUndefined();
    expect(result.confidence).toBe('weak');
  });

  it('does not attribute a keyless branch when nothing resolves its base', () => {
    const result = attribute({ block: block({ branch: 'fix/logout-confirmation' }), config: FIP });

    expect(result.issueKey).toBeUndefined();
  });

  it('attributes a keyless branch through the merge request opened for it', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: FIP,
      activity: [mergeRequest()],
    });

    expect(result.issueKey).toBe('FIP-3010');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.find((entry) => entry.kind === 'merge-request')?.summary).toBe('Confirm before logging out');
  });

  it('matches a merge request branch that still carries its ref prefix', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: FIP,
      activity: [mergeRequest({ branch: 'refs/heads/fix/logout-confirmation' })],
    });

    expect(result.issueKey).toBe('FIP-3010');
  });

  it('lets a conforming branch outrank a merge request naming another issue', () => {
    const result = attribute({
      block: block({ branch: 'feat/FIP-2177-user-management' }),
      config: FIP,
      activity: [mergeRequest({ branch: 'feat/FIP-2177-user-management' })],
    });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('certain');
  });

  it('takes an issue viewed during the block only weakly', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }),
      config: FIP,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, detail: 'viewed FIP-3010' })],
    });

    expect(result.issueKey).toBe('FIP-3010');
    expect(result.confidence).toBe('weak');
  });

  it('ignores activity that falls outside the block', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }),
      config: FIP,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, at: new Date('2026-08-11T14:00:00Z') })],
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('falls back to a recurring Tempo pattern when nothing else attributes the block', () => {
    const result = attribute({ block: localBlock({ appId: 'meet' }), config: FIP, patterns: [TUESDAY_PATTERN] });

    expect(result.issueKey).toBe('FIP-9000');
    expect(result.confidence).toBe('weak');
    expect(result.evidence.map((entry) => entry.kind)).toContain('tempo-history');
  });

  it('lets activity outrank a recurring pattern', () => {
    const result = attribute({
      block: localBlock({ appId: 'chrome' }),
      config: FIP,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, at: new Date(2026, 7, 11, 10, 30) })],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('FIP-3010');
  });

  it('lets a recurring pattern outrank a window title', () => {
    const result = attribute({
      block: localBlock({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date(2026, 7, 11, 10, 0), detail: '[FIP-2222] Button not visible - Jira' },
      ]),
      config: FIP,
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('FIP-9000');
  });

  it('attributes a keyless branch through the rule the user wrote for it', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: FIP,
      rules: [BRANCH_RULE],
    });

    expect(result.issueKey).toBe('FIP-2904');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.at(-1)?.detail).toBe('you assigned `ea-frontend @ refactor/hub-query-v3` to FIP-2904');
  });

  it('lets a conforming branch outrank a rule for the same repository', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/FIP-2177-user-management' }),
      config: FIP,
      rules: [REPO_RULE],
    });

    expect(result.issueKey).toBe('FIP-2177');
    expect(result.confidence).toBe('certain');
  });

  it('lets a branch rule outrank a merge request naming another issue', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: FIP,
      rules: [BRANCH_RULE],
      activity: [mergeRequest({ branch: 'refactor/hub-query-v3' })],
    });

    expect(result.issueKey).toBe('FIP-2904');
  });

  /** A rule about a whole project says only which project, so an MR for this very branch beats it. */
  it('lets a merge request outrank a repository-wide rule', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'fix/logout-confirmation' }),
      config: FIP,
      rules: [REPO_RULE],
      activity: [mergeRequest()],
    });

    expect(result.issueKey).toBe('FIP-3010');
  });

  it('takes a repository-wide rule weakly, and above a recurring pattern', () => {
    const result = attribute({
      block: localBlock({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' }),
      config: FIP,
      rules: [REPO_RULE],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('FIP-100');
    expect(result.confidence).toBe('weak');
  });

  describe('an inferred attribution', () => {
    const INFERRED = [
      {
        contextId: 'repo:/Users/tom/dev/ea-frontend@refactor/hub-query-v3',
        issueKey: 'FIP-2201',
        reason: 'the branch and the commits both name the query rewrite',
      },
    ];

    it('names a context nothing else could, weakly and with its reason in the chain', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
        config: FIP,
        inferred: INFERRED,
      });

      expect(result.issueKey).toBe('FIP-2201');
      expect(result.confidence).toBe('weak');
      expect(result.evidence.at(-1)).toMatchObject({
        kind: 'model',
        detail: 'suggested FIP-2201 — the branch and the commits both name the query rewrite',
      });
    });

    it('never reaches a context the provider was not shown', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v4' }),
        config: FIP,
        inferred: INFERRED,
      });

      expect(result.issueKey).toBeUndefined();
    });

    it('loses to every deterministic rung, including a repository-wide rule', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
        config: FIP,
        rules: [REPO_RULE],
        inferred: INFERRED,
      });

      expect(result.issueKey).toBe('FIP-100');
      expect(result.evidence.some((entry) => entry.kind === 'model')).toBe(false);
    });
  });
});
