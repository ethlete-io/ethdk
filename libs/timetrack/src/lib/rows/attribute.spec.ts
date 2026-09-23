import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { IssueActivity, attribute } from './attribute';
import { TimetrackProjectLink } from '../model/project-link';
import { RecurringPattern } from '../model/recurrence';
import { AttributionRule } from '../model/attribution';
import { StandIn } from '../model/stand-in';

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
  author: 'user',
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const BRANCH_RULE: AttributionRule = {
  ...REPO_RULE,
  id: 'rule-branch',
  branch: 'refactor/hub-query-v3',
  target: { kind: 'issue', issueKey: 'ABC-2904' },
};

const STAND_IN: StandIn = {
  id: 'stand-in-1',
  name: 'Competition Journey',
  state: 'open',
  days: [],
  author: 'user',
  createdAt: new Date('2026-08-01T00:00:00Z'),
};

const STAND_IN_RULE: AttributionRule = {
  ...REPO_RULE,
  id: 'rule-stand-in',
  branch: 'refactor/hub-query-v3',
  target: { kind: 'stand-in', standInId: 'stand-in-1' },
};

const DONATE_RULE: AttributionRule = {
  id: 'rule-donate',
  repoPath: '/Users/tom/dev/ethlete-sdk',
  target: { kind: 'donate' },
  author: 'user',
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

  it('names a keyless branch with the stand-in the user opened for it, and no issue key', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: CONFIG,
      rules: [STAND_IN_RULE],
      standIns: [STAND_IN],
    });

    expect(result.standInId).toBe('stand-in-1');
    expect(result.issueKey).toBeUndefined();
    expect(result.confidence).toBe('likely');
    expect(result.evidence.at(-1)?.detail).toBe(
      'you called `ea-frontend @ refactor/hub-query-v3` Competition Journey, and Jira holds no ticket for it yet',
    );
  });

  it('lets a conforming branch outrank the stand-in, so the stand-in ends without being told', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'feat/ABC-2177-user-management' }),
      config: CONFIG,
      rules: [{ ...STAND_IN_RULE, branch: 'feat/ABC-2177-user-management' }],
      standIns: [STAND_IN],
    });

    expect(result.issueKey).toBe('ABC-2177');
    expect(result.standInId).toBeUndefined();
  });

  it('lets a stand-in rule outrank a merge request naming another issue', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: CONFIG,
      rules: [STAND_IN_RULE],
      standIns: [STAND_IN],
      activity: [mergeRequest({ branch: 'refactor/hub-query-v3' })],
    });

    expect(result.standInId).toBe('stand-in-1');
    expect(result.issueKey).toBeUndefined();
  });

  it('falls through to the rungs below when the stand-in a rule names was deleted', () => {
    const result = attribute({
      block: block({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'refactor/hub-query-v3' }),
      config: CONFIG,
      rules: [STAND_IN_RULE],
      standIns: [],
      activity: [mergeRequest({ branch: 'refactor/hub-query-v3' })],
    });

    expect(result.standInId).toBeUndefined();
    expect(result.issueKey).toBe('ABC-3010');
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

  it('takes a repository-wide rule above a recurring pattern, and as a statement the user made', () => {
    const result = attribute({
      block: localBlock({ repoPath: '/Users/tom/dev/ea-frontend', branch: 'next' }),
      config: CONFIG,
      rules: [REPO_RULE],
      patterns: [TUESDAY_PATTERN],
    });

    expect(result.issueKey).toBe('ABC-100');
    expect(result.confidence).toBe('likely');
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

describe('attribute — the sibling-checkout rung', () => {
  const epicLink = (path: string, projectKey: string): TimetrackProjectLink => ({
    id: `link-${path}`,
    path,
    target: { kind: 'project', projectKey },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

  const EPIC_LINKS = [epicLink('/dev/specs', 'ABC'), epicLink('/dev/frontend', 'ABC')];

  const EPICS = {
    siblings: [
      {
        repoPath: '/dev/specs',
        branch: 'spec/20260819_bracket-challenge',
        issueKey: 'ABC-12623',
        parentKey: 'ABC-12605',
        parentType: 'Epic',
        siblingKeys: ['ABC-12623', 'ABC-12624'],
        truncated: false,
      },
    ],
    claimed: ['ABC-12623'],
  };

  const EPIC_BLOCK = block({ repoPath: '/dev/frontend', branch: 'feature/20260819_bracket-challenge' });

  it('names the block from the one free child of the sibling parent', () => {
    const result = attribute({ block: EPIC_BLOCK, config: CONFIG, links: EPIC_LINKS, epics: EPICS });

    expect(result.issueKey).toBe('ABC-12624');
    expect(result.storyKey).toBe('ABC-12605');
    expect(result.confidence).toBe('likely');
    expect(result.evidence.at(-1)?.kind).toBe('sibling-checkout');
  });

  it('loses to a merge request opened for this very branch', () => {
    const result = attribute({
      block: EPIC_BLOCK,
      config: CONFIG,
      links: EPIC_LINKS,
      epics: EPICS,
      activity: [mergeRequest({ issueKey: 'ABC-4040', branch: 'feature/20260819_bracket-challenge' })],
    });

    expect(result.issueKey).toBe('ABC-4040');
  });

  it('beats a recurring Tempo pattern', () => {
    const result = attribute({
      block: localBlock({ repoPath: '/dev/frontend', branch: 'feature/20260819_bracket-challenge' }),
      config: CONFIG,
      links: EPIC_LINKS,
      epics: EPICS,
      patterns: [{ ...TUESDAY_PATTERN, fromMinute: 9 * 60, toMinute: 12 * 60 }],
    });

    expect(result.issueKey).toBe('ABC-12624');
  });

  it('takes a stand-in rule out of the way, because the real ticket now exists', () => {
    const standIn: StandIn = {
      id: 'stand-in:1:frontend',
      name: 'the bracket challenge',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      state: 'open',
      author: 'user',
      days: [],
    };
    const rule: AttributionRule = {
      id: 'repo:/dev/frontend#1',
      repoPath: '/dev/frontend',
      target: { kind: 'stand-in', standInId: standIn.id },
      author: 'user',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    };
    const options = { config: CONFIG, links: EPIC_LINKS, rules: [rule], standIns: [standIn] };

    expect(attribute({ block: EPIC_BLOCK, ...options }).standInId).toBe(standIn.id);

    const named = attribute({ block: EPIC_BLOCK, ...options, epics: EPICS });

    expect(named.issueKey).toBe('ABC-12624');
    expect(named.standInId).toBeUndefined();
  });

  it('loses to a rule of the user own naming a real issue', () => {
    const rule: AttributionRule = {
      id: 'repo:/dev/frontend#2',
      repoPath: '/dev/frontend',
      target: { kind: 'issue', issueKey: 'ABC-5050' },
      author: 'user',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    };
    const result = attribute({
      block: EPIC_BLOCK,
      config: CONFIG,
      links: EPIC_LINKS,
      rules: [rule],
      epics: EPICS,
    });

    expect(result.issueKey).toBe('ABC-5050');
  });
});

describe('attribute — a stand-in a sibling checkout holds', () => {
  const FIFAGG_CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIFAGG', 'FIP'] });

  const fifaggLink = (path: string): TimetrackProjectLink => ({
    id: `link-${path}`,
    path,
    target: { kind: 'project', projectKey: 'FIFAGG' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });

  const LINKS = [fifaggLink('/home/tom/dev/fifagg/fifagg-frontend'), fifaggLink('/home/tom/dev/fifagg/specs')];

  const BRACKET_CHALLENGE: StandIn = {
    id: 'stand-in:1789989837130:specs-main-context-tracks-20260819-bracket-challenge',
    name: 'Bracket challenge',
    openedFor: '/home/tom/dev/fifagg/specs',
    openedForBranch: 'main',
    openedForWorkPath: 'context/tracks/20260819_bracket-challenge',
    projectKey: 'FIFAGG',
    state: 'open',
    days: [],
    author: 'app',
    createdAt: new Date('2026-09-22T00:00:00Z'),
  };

  const FRONTEND = { repoPath: '/home/tom/dev/fifagg/fifagg-frontend', branch: 'feature/20260819_bracket-challenge' };

  const MEETING_VIEW = mergeRequest({
    kind: 'issue-view',
    issueKey: 'FIP-2867',
    branch: undefined,
    detail: 'viewed FIP-2867',
  });

  it('takes the open stand-in of the same project whose work path carries this branch slug', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: LINKS,
      standIns: [BRACKET_CHALLENGE],
      activity: [MEETING_VIEW],
    });

    expect(result.standInId).toBe(BRACKET_CHALLENGE.id);
    expect(result.issueKey).toBeUndefined();
    expect(result.confidence).toBe('likely');
    expect(result.evidence.at(-1)).toMatchObject({
      kind: 'sibling-checkout',
      detail: '`specs` holds stand-in Bracket challenge for the same branch name',
    });
  });

  it('ignores a resolved stand-in, one of another project, and two that match', () => {
    const run = (standIns: StandIn[]) =>
      attribute({ block: block(FRONTEND), config: FIFAGG_CONFIG, links: LINKS, standIns }).standInId;

    expect(run([{ ...BRACKET_CHALLENGE, state: 'resolved' }])).toBeUndefined();
    expect(run([{ ...BRACKET_CHALLENGE, projectKey: 'FIP' }])).toBeUndefined();
    expect(run([BRACKET_CHALLENGE, { ...BRACKET_CHALLENGE, id: 'stand-in:2' }])).toBeUndefined();
  });

  it('reads the slug of the branch the stand-in was opened on when that branch names work', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: LINKS,
      standIns: [
        { ...BRACKET_CHALLENGE, openedForBranch: 'spec/20260819_bracket-challenge', openedForWorkPath: undefined },
      ],
    });

    expect(result.standInId).toBe(BRACKET_CHALLENGE.id);
  });

  it('needs a project link on the block', () => {
    const result = attribute({ block: block(FRONTEND), config: FIFAGG_CONFIG, standIns: [BRACKET_CHALLENGE] });

    expect(result.standInId).toBeUndefined();
  });

  it('loses to a merge request opened for this very branch', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: LINKS,
      standIns: [BRACKET_CHALLENGE],
      activity: [mergeRequest({ issueKey: 'FIFAGG-4040', branch: FRONTEND.branch })],
    });

    expect(result.issueKey).toBe('FIFAGG-4040');
    expect(result.standInId).toBeUndefined();
  });

  it('loses to the real issue a sibling checkout names through its epic', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: LINKS,
      standIns: [BRACKET_CHALLENGE],
      epics: {
        siblings: [
          {
            repoPath: '/home/tom/dev/fifagg/specs',
            branch: 'spec/20260819_bracket-challenge',
            issueKey: 'FIFAGG-12623',
            parentKey: 'FIFAGG-12605',
            parentType: 'Epic',
            siblingKeys: ['FIFAGG-12623', 'FIFAGG-12624'],
            truncated: false,
          },
        ],
        claimed: ['FIFAGG-12623'],
      },
    });

    expect(result.issueKey).toBe('FIFAGG-12624');
    expect(result.standInId).toBeUndefined();
  });

  it('loses to a rule the user wrote for the checkout', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: LINKS,
      standIns: [BRACKET_CHALLENGE],
      rules: [{ ...REPO_RULE, repoPath: FRONTEND.repoPath, target: { kind: 'issue', issueKey: 'FIFAGG-100' } }],
    });

    expect(result.issueKey).toBe('FIFAGG-100');
    expect(result.standInId).toBeUndefined();
  });
});

describe('attribute — a project link guards the coincidence rungs', () => {
  const FIFAGG_CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIFAGG', 'FIP'] });

  const LINK: TimetrackProjectLink = {
    id: 'link-frontend',
    path: '/home/tom/dev/fifagg/fifagg-frontend',
    target: { kind: 'project', projectKey: 'FIFAGG' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const FRONTEND = { repoPath: '/home/tom/dev/fifagg/fifagg-frontend', branch: 'feature/20260819_bracket-challenge' };

  const view = (issueKey: string, at = new Date('2026-08-11T08:30:00Z')) =>
    mergeRequest({ kind: 'issue-view', issueKey, branch: undefined, at, detail: `viewed ${issueKey}` });

  it('skips an issue of another project opened during the block, and takes one of its own', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: [LINK],
      activity: [view('FIP-2867'), view('FIFAGG-12624', new Date('2026-08-11T08:40:00Z'))],
    });

    expect(result.issueKey).toBe('FIFAGG-12624');
  });

  it('leaves the block unnamed when only another project was seen during it', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: [LINK],
      activity: [view('FIP-2867')],
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('still takes a merge request opened for this branch in another project', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: [LINK],
      activity: [mergeRequest({ issueKey: 'FIP-4040', branch: FRONTEND.branch })],
    });

    expect(result.issueKey).toBe('FIP-4040');
  });

  it('picks the strongest Tempo pattern of its own project, not the strongest overall', () => {
    const result = attribute({
      block: localBlock(FRONTEND),
      config: FIFAGG_CONFIG,
      links: [LINK],
      patterns: [
        { ...TUESDAY_PATTERN, issueKey: 'FIP-2867', occurrences: 9 },
        { ...TUESDAY_PATTERN, issueKey: 'FIFAGG-500', occurrences: 3 },
      ],
    });

    expect(result.issueKey).toBe('FIFAGG-500');
  });

  it('tries the next window title when the first names another project', () => {
    const result = attribute({
      block: block(FRONTEND, [
        { kind: 'window-title', at: new Date('2026-08-11T08:00:00Z'), detail: '[FIP-2867] PM & Meetings - Jira' },
        { kind: 'window-title', at: new Date('2026-08-11T08:10:00Z'), detail: '[FIFAGG-12624] Bracket - Jira' },
      ]),
      config: FIFAGG_CONFIG,
      links: [LINK],
    });

    expect(result.issueKey).toBe('FIFAGG-12624');
  });

  it('drops a model inference naming another project', () => {
    const result = attribute({
      block: block(FRONTEND),
      config: FIFAGG_CONFIG,
      links: [LINK],
      inferred: [
        {
          contextId: 'repo:/home/tom/dev/fifagg/fifagg-frontend@feature/20260819_bracket-challenge',
          issueKey: 'FIP-2867',
          reason: 'meetings',
        },
      ],
    });

    expect(result.issueKey).toBeUndefined();
  });

  it('changes nothing without a link', () => {
    const result = attribute({ block: block(FRONTEND), config: FIFAGG_CONFIG, activity: [view('FIP-2867')] });

    expect(result.issueKey).toBe('FIP-2867');
  });
});
