import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { WorkGroup } from '../rows/merge';
import { AttributionRule, UnnamedContext } from '../model/attribution';
import { ActivityBlock, ActivityContext, contextKey } from '../model/block';
import { Evidence } from '../model/evidence';
import { TimetrackProjectLink } from '../model/project-link';
import { StandIn, StandInRefusal } from '../model/stand-in';
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
  refused?: readonly StandInRefusal[];
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
    refused: options.refused ?? [],
    day: '2026-09-15',
    now: NOW,
  });

describe('autoStandIns', () => {
  it('opens one per directory of a base branch, which is the only thing that names the work there', () => {
    const rework = { repoPath: FIFAGG, branch: 'main', workPath: 'context/tracks/20260921_rework' };
    const journey = { repoPath: FIFAGG, branch: 'main', workPath: 'context/tracks/20260808_journey' };
    const opened = open({ contexts: [unnamed(rework, 45 * 60_000), unnamed(journey, 75 * 60_000)] });

    expect(opened).toHaveLength(2);
    expect(opened.map((entry) => entry.standIn.openedForWorkPath).sort()).toEqual(
      [journey.workPath, rework.workPath].sort(),
    );
    expect(opened.map((entry) => entry.rule.workPath).sort()).toEqual([journey.workPath, rework.workPath].sort());
  });

  it('still opens none for a base branch no directory could split', () => {
    expect(open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'main' }, 45 * 60_000)] })).toEqual([]);
  });

  it('leaves a directory of a base branch alone once a record waits on it', () => {
    const context = { repoPath: FIFAGG, branch: 'main', workPath: 'context/tracks/20260921_rework' };
    const waiting: StandIn = {
      id: 'stand-in:1:rework',
      name: 'The rework',
      state: 'open',
      openedFor: FIFAGG,
      openedForBranch: 'main',
      openedForWorkPath: context.workPath,
      days: ['2026-09-14'],
      author: 'app',
      createdAt: new Date('2026-09-14T09:00:00Z'),
    };

    expect(open({ contexts: [unnamed(context, 45 * 60_000)], standIns: [waiting] })).toEqual([]);
  });

  it('opens one stand-in for a branch nothing could name', () => {
    const opened = open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'feat/user-management' }, 45 * 60_000)] });

    expect(opened).toHaveLength(1);
    expect(opened[0]?.standIn.state).toBe('open');
    expect(opened[0]?.standIn.projectKey).toBe('FIF');
    expect(opened[0]?.standIn.author).toBe('app');
    expect(opened[0]?.standIn.days).toEqual(['2026-09-15']);
  });

  it('opens one per branch, each named from its own work, so one checkout is not one ticket', () => {
    const early = { repoPath: FIFAGG, branch: 'dev-player-name-auto-size' };
    const late = { repoPath: FIFAGG, branch: 'dev-toty-public-fixes' };
    const opened = open({
      contexts: [unnamed(early, 45 * 60_000), unnamed(late, 75 * 60_000)],
      unattributed: [
        group(early, [commit('feat(platform): Auto size the player item name')]),
        group(late, [commit('fix(toty-public): Correct the showcase layout')]),
      ],
    });

    expect(opened).toHaveLength(2);
    expect(opened.map((entry) => entry.rule.branch)).toEqual(['dev-player-name-auto-size', 'dev-toty-public-fixes']);
    expect(opened.map((entry) => entry.standIn.name)).toEqual(['Player name auto size', 'Toty public fixes']);
    expect(new Set(opened.map((entry) => entry.standIn.id)).size).toBe(2);
    expect(opened[0]?.rule.repoPath).toBe(FIFAGG);
    expect(opened[0]?.rule.target).toEqual({ kind: 'stand-in', standInId: opened[0]?.standIn.id });
    expect(opened[0]?.observedMs).toBe(45 * 60_000);
  });

  it('opens none for a base branch, because integration is not one piece of work', () => {
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'next' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'main' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
    ];

    expect(open({ contexts }).map((entry) => entry.rule.branch)).toEqual(['feat/x']);
  });

  it('reads a ref and a branch name as one branch', () => {
    const opened = open({
      contexts: [
        unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 10 * 60_000),
        unnamed({ repoPath: FIFAGG, branch: 'refs/heads/feat/x' }, 10 * 60_000),
      ],
    });

    expect(opened).toHaveLength(1);
    expect(opened[0]?.rule.branch).toBe('feat/x');
    expect(opened[0]?.observedMs).toBe(20 * 60_000);
  });

  it('opens nothing for a branch a stand-in rule already covers, and still opens for its sibling', () => {
    const rules: AttributionRule[] = [
      {
        id: 'rule:1',
        repoPath: FIFAGG,
        branch: 'feat/x',
        target: { kind: 'stand-in', standInId: 'stand-in:1' },
        author: 'app',
        createdAt: new Date('2026-09-14T09:00:00Z'),
      },
    ];
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/y' }, 45 * 60_000),
    ];

    expect(open({ contexts, rules }).map((entry) => entry.rule.branch)).toEqual(['feat/y']);
  });

  it('opens nothing at all for a checkout a checkout-wide rule already covers', () => {
    const rules: AttributionRule[] = [
      {
        id: 'rule:1',
        repoPath: FIFAGG,
        target: { kind: 'stand-in', standInId: 'stand-in:1' },
        author: 'app',
        createdAt: new Date('2026-09-14T09:00:00Z'),
      },
    ];
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/y' }, 45 * 60_000),
    ];

    expect(open({ contexts, rules })).toEqual([]);
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

  it('opens nothing for a checkout that reports no branch, rather than covering the whole of it', () => {
    expect(open({ contexts: [unnamed({ repoPath: FIFAGG }, 45 * 60_000)] })).toEqual([]);
  });

  it('leaves a branch below the floor alone, and opens once that branch adds up past it', () => {
    const short = unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 5 * 60_000);
    const other = unnamed({ repoPath: FIFAGG, branch: 'fix/y' }, 12 * 60_000);
    const more = unnamed({ repoPath: FIFAGG, branch: 'refs/heads/feat/x' }, 12 * 60_000);

    expect(open({ contexts: [short, other] })).toEqual([]);
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

  it('names it from the branch, and quotes what the branch says about itself', () => {
    const context = { repoPath: FIFAGG, branch: 'fix/login-redirect' };
    const opened = open({
      contexts: [unnamed(context, 90 * 60_000)],
      unattributed: [group(context, [commit('Send the user back to where they came from')])],
    });

    expect(opened[0]?.standIn.name).toBe('Login redirect');
    expect(opened[0]?.standIn.description).toContain('Send the user back to where they came from');
    expect(opened[0]?.standIn.description).toContain('1h 30m');
  });

  it('opens nothing for a directory inside a checkout, so one branch keeps one stand-in', () => {
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

  it('opens none for a branch a stand-in already waits on, and still opens for its sibling', () => {
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/y' }, 45 * 60_000),
    ];
    const waiting = open({ contexts: [contexts[0]!] })[0]!.standIn;

    expect(open({ contexts, standIns: [waiting] }).map((entry) => entry.rule.branch)).toEqual(['feat/y']);
  });

  it('opens none anywhere in a checkout a record from the wider grain still waits on', () => {
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/y' }, 45 * 60_000),
    ];
    const wide = open({ contexts: [contexts[0]!] })[0]!.standIn;

    expect(open({ contexts, standIns: [{ ...wide, openedForBranch: undefined }] })).toEqual([]);
  });

  it('opens one again once the stand-in that waited on the branch is resolved', () => {
    const contexts = [unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000)];
    const waiting = open({ contexts })[0]!.standIn;

    expect(open({ contexts, standIns: [{ ...waiting, state: 'resolved', issueKey: 'FIF-1' }] })).toHaveLength(1);
  });

  it('opens none for a branch the user refused one for, and still opens for its sibling', () => {
    const contexts = [
      unnamed({ repoPath: FIFAGG, branch: 'feat/x' }, 45 * 60_000),
      unnamed({ repoPath: FIFAGG, branch: 'feat/y' }, 45 * 60_000),
    ];

    expect(open({ contexts, refused: [{ repoPath: FIFAGG, branch: 'feat/x' }] }).map((e) => e.rule.branch)).toEqual([
      'feat/y',
    ]);
    expect(open({ contexts, refused: [{ repoPath: FIFAGG }] })).toEqual([]);
    expect(open({ contexts, refused: [{ repoPath: OTHER }] })).toHaveLength(2);
  });

  it('records the checkout and the branch it opened for, so a delete knows what to refuse', () => {
    const opened = open({ contexts: [unnamed({ repoPath: FIFAGG, branch: 'refs/heads/feat/x' }, 45 * 60_000)] });

    expect(opened[0]?.standIn.openedFor).toBe(FIFAGG);
    expect(opened[0]?.standIn.openedForBranch).toBe('feat/x');
  });
});
