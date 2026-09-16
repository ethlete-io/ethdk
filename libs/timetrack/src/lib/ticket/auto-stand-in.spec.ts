import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { WorkGroup } from '../rows/merge';
import { AttributionRule, UnnamedContext } from '../model/attribution';
import { ActivityBlock, ActivityContext, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { TimetrackProjectLink } from '../model/project-link';
import { StandIn } from '../model/stand-in';
import { autoStandIns } from './auto-stand-in';

const FIFAGG = '/Users/tom/dev/fifagg-frontend';
const OTHER = '/Users/tom/dev/side-project';
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['FIP'] });
const NOW = new Date('2026-09-15T09:00:00Z');

const link = (path: string, target: TimetrackProjectLink['target']): TimetrackProjectLink => ({
  id: `link:${path}`,
  path,
  target,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

const unnamed = (context: ActivityContext, observedMs: number): UnnamedContext => ({
  id: contextKey(context),
  context,
  observedMs,
  from: new Date('2026-09-15T09:00:00Z'),
  to: new Date('2026-09-15T10:00:00Z'),
  suggestion: { repoPath: context.repoPath, branch: context.branch, appId: context.appId },
});

const group = (context: ActivityContext, entries: Evidence[]): WorkGroup => {
  const block: ActivityBlock = {
    from: new Date('2026-09-15T09:00:00Z'),
    to: new Date('2026-09-15T10:00:00Z'),
    context,
    evidence: entries,
  };

  return { from: block.from, to: block.to, observedMs: 0, confidence: 'weak', evidence: [], blocks: [block] };
};

const commit = (summary: string): Evidence => ({
  kind: 'commit',
  at: new Date('2026-09-15T09:30:00Z'),
  detail: summary,
  summary,
});

const open = (options: {
  contexts: readonly UnnamedContext[];
  unattributed?: readonly WorkGroup[];
  links?: readonly TimetrackProjectLink[];
  rules?: readonly AttributionRule[];
  repoRoots?: readonly string[] | null;
  offeredCheckouts?: readonly string[];
  standIns?: readonly StandIn[];
  refusedCheckouts?: readonly string[];
}) =>
  autoStandIns({
    contexts: options.contexts,
    unattributed: options.unattributed ?? [],
    links: options.links ?? [link(FIFAGG, { kind: 'project', projectKey: 'FIF' })],
    rules: options.rules ?? [],
    config: CONFIG,
    repoRoots: options.repoRoots === undefined ? [FIFAGG, OTHER] : options.repoRoots,
    offeredCheckouts: options.offeredCheckouts ?? [],
    standIns: options.standIns ?? [],
    refusedCheckouts: options.refusedCheckouts ?? [],
    day: '2026-09-15',
    now: NOW,
  });

describe('autoStandIns', () => {
  it('opens one stand-in for a linked checkout nothing could name', () => {
    const opened = open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/user-management' }, 45 * 60_000)] });

    expect(opened).toHaveLength(1);
    expect(opened[0]?.standIn.state).toBe('open');
    expect(opened[0]?.standIn.projectKey).toBe('FIF');
    expect(opened[0]?.standIn.author).toBe('app');
    expect(opened[0]?.standIn.days).toEqual(['2026-09-15']);
  });

  it('writes one repo-wide rule, so every branch of the checkout lands on the same stand-in', () => {
    const opened = open({
      contexts: [
        unnamed({ repoPath: FIFAGG, branch: 'feat/user-management' }, 45 * 60_000),
        unnamed({ repoPath: FIFAGG, branch: 'fix/login' }, 20 * 60_000),
      ],
    });

    expect(opened).toHaveLength(1);
    expect(opened[0]?.rule.repoPath).toBe(FIFAGG);
    expect(opened[0]?.rule.branch).toBeUndefined();
    expect(opened[0]?.rule.target).toEqual({ kind: 'stand-in', standInId: opened[0]?.standIn.id });
    expect(opened[0]?.observedMs).toBe(65 * 60_000);
  });

  it('opens nothing for a checkout a stand-in rule already covers', () => {
    const rules: AttributionRule[] = [
      {
        id: 'rule:1',
        repoPath: FIFAGG,
        target: { kind: 'stand-in', standInId: 'stand-in:1' },
        author: 'app',
        createdAt: new Date('2026-09-14T09:00:00Z'),
      },
    ];

    expect(open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)], rules })).toEqual([]);
  });

  it('opens nothing for a checkout no link covers', () => {
    expect(open({ contexts: [unnamed({ repoPath: OTHER, branch: 'feat/x' }, 45 * 60_000)] })).toEqual([]);
  });

  it('opens nothing for a checkout linked as private', () => {
    const links = [link(OTHER, { kind: 'private' })];

    expect(open({ contexts: [unnamed({ repoPath: OTHER, branch: 'feat/x' }, 45 * 60_000)], links })).toEqual([]);
  });

  it('opens nothing for a context with no checkout at all', () => {
    expect(open({ contexts: [unnamed({ appId: 'firefox' }, 45 * 60_000)] })).toEqual([]);
  });

  it('leaves a checkout below the floor alone, and opens once the day adds up past it', () => {
    const short = unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 5 * 60_000);
    const more = unnamed({ repoPath: FIFAGG, branch: 'fix/y' }, 12 * 60_000);

    expect(open({ contexts: [short] })).toEqual([]);
    expect(open({ contexts: [short, more] })).toHaveLength(1);
  });

  it('gives two checkouts opened in the same millisecond two ids', () => {
    const links = [
      link(FIFAGG, { kind: 'project', projectKey: 'FIF' }),
      link(OTHER, { kind: 'project', projectKey: 'SID' }),
    ];
    const opened = open({
      links,
      contexts: [
        unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
        unnamed({ repoPath: OTHER, branch: 'feat/y' }, 45 * 60_000),
      ],
    });

    expect(opened).toHaveLength(2);
    expect(new Set(opened.map((entry) => entry.standIn.id)).size).toBe(2);
  });

  it('names it from the branch that held the most time, and says what else it covers', () => {
    const big = { repoPath: FIFAGG, branch: 'feat/user-management' };
    const small = { repoPath: FIFAGG, branch: 'fix/login-redirect' };
    const opened = open({
      contexts: [unnamed(big, 20 * 60_000), unnamed(small, 90 * 60_000)],
      unattributed: [group(small, [commit('Send the user back to where they came from')])],
    });

    expect(opened[0]?.standIn.name).toBe('Login redirect');
    expect(opened[0]?.standIn.description).toContain('Send the user back to where they came from');
    expect(opened[0]?.standIn.description).toContain('feat/user-management');
    expect(opened[0]?.standIn.description).toContain('1h 50m');
  });

  it('falls back to the checkout name when no branch and no note says anything', () => {
    const opened = open({ contexts: [unnamed({ repoPath: FIFAGG }, 45 * 60_000)] });

    expect(opened[0]?.standIn.name).toBe('fifagg-frontend');
    expect(opened[0]?.standIn.description).toContain('Nothing in the day names this work');
  });
  it('opens nothing for a directory inside a checkout, so one checkout keeps one stand-in', () => {
    const inside = `${FIFAGG}/libs/domain/shared/match-overlay`;
    const opened = open({
      contexts: [
        unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
        unnamed({ repoPath: inside, branch: 'feat/x' }, 45 * 60_000),
      ],
    });

    expect(opened).toHaveLength(1);
    expect(opened[0]?.rule.repoPath).toBe(FIFAGG);
  });

  it('opens nothing at all while the repository discovery has not answered', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];

    expect(open({ contexts, repoRoots: null })).toEqual([]);
    expect(open({ contexts })).toHaveLength(1);
  });

  it('still opens one for a checkout the discovery never walked', () => {
    const opened = open({
      contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)],
      repoRoots: [OTHER],
    });

    expect(opened).toHaveLength(1);
  });
  it('opens none for a checkout the app can still offer a real issue for', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];

    expect(open({ contexts, offeredCheckouts: [FIFAGG] })).toEqual([]);
    expect(open({ contexts })).toHaveLength(1);
  });

  it('never replaces a rule that names the checkout an issue', () => {
    const named: AttributionRule = {
      id: 'repo:fifagg',
      repoPath: FIFAGG,
      target: { kind: 'issue', issueKey: 'FIF-1' },
      author: 'user',
      createdAt: new Date('2026-09-01T00:00:00Z'),
    };

    expect(open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)], rules: [named] })).toEqual(
      [],
    );
  });

  it('opens none for a checkout a stand-in already waits on, whatever the rules say', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];
    const waiting = open({ contexts })[0]!.standIn;

    expect(open({ contexts, standIns: [waiting] })).toEqual([]);
  });

  it('opens one again once the stand-in that waited on the checkout is resolved', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];
    const waiting = open({ contexts })[0]!.standIn;

    expect(open({ contexts, standIns: [{ ...waiting, state: 'resolved', issueKey: 'FIF-1' }] })).toHaveLength(1);
  });

  it('opens none for a checkout the user refused one for', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];

    expect(open({ contexts, refusedCheckouts: [FIFAGG] })).toEqual([]);
    expect(open({ contexts, refusedCheckouts: [OTHER] })).toHaveLength(1);
  });

  it('records the checkout it opened for, so a delete knows which one to refuse', () => {
    const opened = open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)] });

    expect(opened[0]?.standIn.openedFor).toBe(FIFAGG);
  });
});
