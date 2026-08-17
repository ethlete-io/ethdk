import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { IssueActivity, attribute } from './attribute';
import { TimetrackProjectLink } from './project-link';
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
  issueKey: 'ABC-3010',
  at: new Date('2026-08-11T08:30:00Z'),
  branch: 'fix/logout-confirmation',
  detail: 'merge request !412 on `fix/logout-confirmation`',
  summary: 'Confirm before logging out',
  ...overrides,
});

const TUESDAY_PATTERN: RecurringPattern = {
  issueKey: 'ABC-9000',
  weekday: 2,
  fromMinute: 9 * 60 + 30,
  toMinute: 10 * 60 + 30,
  occurrences: 5,
};

const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ABC'] });

const REPO_RULE: AttributionRule = {
  id: 'rule-repo',
  repoPath: '/Users/tom/dev/ea-frontend',
  target: { kind: 'issue', issueKey: 'ABC-100' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const BRANCH_RULE: AttributionRule = {
  ...REPO_RULE,
  id: 'rule-branch',
  branch: 'refactor/hub-query-v3',
  target: { kind: 'issue', issueKey: 'ABC-2904' },
};

const DONATE_RULE: AttributionRule = {
  id: 'rule-donate',
  repoPath: '/Users/tom/dev/ethlete-sdk',
  target: { kind: 'donate' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const PRIVATE_LINK: TimetrackProjectLink = {
  id: 'link-private',
  path: '/Users/tom/dev/private',
  target: { kind: 'private' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const PROJECT_LINK: TimetrackProjectLink = {
  id: 'link-ea',
  path: '/Users/tom/dev/ea-frontend',
  target: { kind: 'project', projectKey: 'ABC' },
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

describe('attribute', () => {
  it('is certain about a conforming main feature branch', () => {
    const result = attribute({ block: block({ branch: 'feat/ABC-2177-user-management' }), config: CONFIG });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.storyKey).toBe('ABC-2177');
    expect(result.confidence).toBe('certain');
  });

  it('logs a sub-feature against the task and keeps the story for roll-up', () => {
    const result = attribute({
      block: block({ branch: 'sub/feat/ABC-2177-user-management/ABC-2178-user-password-reset' }),
      config: CONFIG,
    });

    expect(result.issueKey).toBe('ABC-2178');
    expect(result.storyKey).toBe('ABC-2177');
    expect(result.taskKey).toBe('ABC-2178');
    expect(result.confidence).toBe('certain');
  });

  it('drops to likely when the branch names a key but does not conform', () => {
    const result = attribute({ block: block({ branch: 'feature/ABC-2177-user-management' }), config: CONFIG });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.confidence).toBe('likely');
  });

  it('inherits the story through the base branch and says so in the evidence', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: CONFIG,
      resolveBase: () => 'feat/ABC-2177-user-management',
    });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.map((entry) => entry.kind)).toContain('inherited-branch');
  });

  it('falls back to a key in a window title, weakly', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: '[ABC-2222] Button not visible - Jira' },
      ]),
      config: CONFIG,
    });

    expect(result.issueKey).toBe('ABC-2222');
    expect(result.confidence).toBe('weak');
  });

  it('ignores a title key from a project that is not configured', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: 'DEF-99 something else' },
      ]),
      config: CONFIG,
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('reads no key out of free text at all while no project is configured', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: 'ABC-1234 - Cloud console' },
      ]),
      config: resolveGitFlowConfig({ keyPrefixes: [] }),
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('still reads a branch name while no project is configured', () => {
    const result = attribute({
      block: block({ branch: 'feat/ABC-2177-user-management' }),
      config: resolveGitFlowConfig({ keyPrefixes: [] }),
    });

    expect(result.issueKey).toBe('ABC-2177');
  });

  it('leaves a block with no key at all unattributed rather than guessing', () => {
    const result = attribute({ block: block({ appId: 'slack' }), config: CONFIG });

    expect(result.issueKey).toBeUndefined();
    expect(result.confidence).toBe('weak');
  });

  it('does not attribute a keyless branch when nothing resolves its base', () => {
    const result = attribute({ block: block({ branch: 'fix/logout-confirmation' }), config: CONFIG });

    expect(result.issueKey).toBeUndefined();
  });

  it('attributes a keyless branch through the merge request opened for it', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: CONFIG,
      activity: [mergeRequest()],
    });

    expect(result.issueKey).toBe('ABC-3010');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.find((entry) => entry.kind === 'merge-request')?.summary).toBe('Confirm before logging out');
  });

  it('matches a merge request branch that still carries its ref prefix', () => {
    const result = attribute({
      block: block({ branch: 'fix/logout-confirmation' }),
      config: CONFIG,
      activity: [mergeRequest({ branch: 'refs/heads/fix/logout-confirmation' })],
    });

    expect(result.issueKey).toBe('ABC-3010');
  });

  it('lets a conforming branch outrank a merge request naming another issue', () => {
    const result = attribute({
      block: block({ branch: 'feat/ABC-2177-user-management' }),
      config: CONFIG,
      activity: [mergeRequest({ branch: 'feat/ABC-2177-user-management' })],
    });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.confidence).toBe('certain');
  });

  it('takes an issue viewed during the block only weakly', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }),
      config: CONFIG,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, detail: 'viewed ABC-3010' })],
    });

    expect(result.issueKey).toBe('ABC-3010');
    expect(result.confidence).toBe('weak');
  });

  it('ignores activity that falls outside the block', () => {
    const result = attribute({
      block: block({ appId: 'chrome' }),
      config: CONFIG,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, at: new Date('2026-08-11T14:00:00Z') })],
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('falls back to a recurring Tempo pattern when nothing else attributes the block', () => {
    const result = attribute({ block: localBlock({ appId: 'meet' }), config: CONFIG, patterns: [TUESDAY_PATTERN] });

    expect(result.issueKey).toBe('ABC-9000');
    expect(result.confidence).toBe('weak');
    expect(result.evidence.map((entry) => entry.kind)).toContain('tempo-history');
  });

  it('lets activity outrank a recurring pattern', () => {
    const result = attribute({
      block: localBlock({ appId: 'chrome' }),
      config: CONFIG,
      activity: [mergeRequest({ kind: 'issue-view', branch: undefined, at: new Date(2026, 7, 11, 10, 30) })],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('ABC-3010');
  });

  it('lets a recurring pattern outrank a window title', () => {
    const result = attribute({
      block: localBlock({ appId: 'chrome' }, [
        { kind: 'window-title', at: new Date(2026, 7, 11, 10, 0), detail: '[ABC-2222] Button not visible - Jira' },
      ]),
      config: CONFIG,
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('ABC-9000');
  });

  it('attributes a keyless branch through the rule the user wrote for it', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: CONFIG,
      rules: [BRANCH_RULE],
    });

    expect(result.issueKey).toBe('ABC-2904');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.at(-1)?.detail).toBe('you assigned `ea-frontend @ refactor/hub-query-v3` to ABC-2904');
  });

  it('lets a conforming branch outrank a rule for the same repository', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/ABC-2177-user-management' }),
      config: CONFIG,
      rules: [REPO_RULE],
    });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.confidence).toBe('certain');
  });

  it('lets a branch rule outrank a merge request naming another issue', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: CONFIG,
      rules: [BRANCH_RULE],
      activity: [mergeRequest({ branch: 'refactor/hub-query-v3' })],
    });

    expect(result.issueKey).toBe('ABC-2904');
  });

  /** A rule about a whole project says only which project, so an MR for this very branch beats it. */
  it('lets a merge request outrank a repository-wide rule', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'fix/logout-confirmation' }),
      config: CONFIG,
      rules: [REPO_RULE],
      activity: [mergeRequest()],
    });

    expect(result.issueKey).toBe('ABC-3010');
  });

  it('takes a repository-wide rule weakly, and above a recurring pattern', () => {
    const result = attribute({
      block: localBlock({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' }),
      config: CONFIG,
      rules: [REPO_RULE],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('ABC-100');
    expect(result.confidence).toBe('weak');
  });

  it('leaves a donating context for the day to place, rather than reading a browser tab', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ethlete-sdk', branch: 'next' }, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: '[ABC-2222] Button not visible - Jira' },
      ]),
      config: CONFIG,
      rules: [DONATE_RULE],
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('leaves a donating context alone even where a recurring pattern would claim it', () => {
    const result = attribute({
      block: localBlock({ repoPath: '/Users/tom/dev/ethlete-sdk', branch: 'next' }),
      config: CONFIG,
      rules: [DONATE_RULE],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBeUndefined();
  });

  describe('an inferred attribution', () => {
    const INFERRED = [
      {
        contextId: 'repo:/Users/tom/dev/ea-frontend@refactor/hub-query-v3',
        issueKey: 'ABC-2201',
        reason: 'the branch and the commits both name the query rewrite',
      },
    ];

    it('names a context nothing else could, weakly and with its reason in the chain', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
        config: CONFIG,
        inferred: INFERRED,
      });

      expect(result.issueKey).toBe('ABC-2201');
      expect(result.confidence).toBe('weak');
      expect(result.evidence.at(-1)).toMatchObject({
        kind: 'model',
        detail: 'suggested ABC-2201 — the branch and the commits both name the query rewrite',
      });
    });

    it('never reaches a context the provider was not shown', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v4' }),
        config: CONFIG,
        inferred: INFERRED,
      });

      expect(result.issueKey).toBeUndefined();
    });

    it('loses to every deterministic rung, including a repository-wide rule', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
        config: CONFIG,
        rules: [REPO_RULE],
        inferred: INFERRED,
      });

      expect(result.issueKey).toBe('ABC-100');
      expect(result.evidence.some((entry) => entry.kind === 'model')).toBe(false);
    });
  });

  describe('a private link', () => {
    it('answers before the branch grammar, so a side project keeps no key it happens to spell', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/private/game', branch: 'feat/ABC-2177-user-management' }),
        config: CONFIG,
        links: [PRIVATE_LINK],
      });

      expect(result.issueKey).toBeUndefined();
      expect(result.privateLink).toBe(PRIVATE_LINK);
      expect(result.evidence.at(-1)).toEqual({
        kind: 'project-link',
        at: result.block.from,
        detail: 'you marked `private` private',
      });
    });

    it('answers before a rule the user wrote for the same repository', () => {
      const rule: AttributionRule = { ...REPO_RULE, repoPath: '/Users/tom/dev/private/game' };
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/private/game' }),
        config: CONFIG,
        rules: [rule],
        links: [PRIVATE_LINK],
      });

      expect(result.issueKey).toBeUndefined();
      expect(result.privateLink).toBe(PRIVATE_LINK);
    });

    it('leaves a repository the same root links to a project alone', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/ABC-2177-user-management' }),
        config: CONFIG,
        links: [PRIVATE_LINK, PROJECT_LINK],
      });

      expect(result.issueKey).toBe('ABC-2177');
      expect(result.privateLink).toBeUndefined();
    });

    it('changes nothing for a link that only names a project', () => {
      const result = attribute({
        block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
        config: CONFIG,
        links: [PROJECT_LINK],
      });

      expect(result.issueKey).toBeUndefined();
      expect(result.privateLink).toBeUndefined();
      expect(result.evidence.some((entry) => entry.kind === 'project-link')).toBe(false);
    });
  });
});
