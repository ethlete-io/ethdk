import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { AttributionRule } from '../model/attribution';
import { CollectedEvent } from '../model/event';
import { reviewDay } from '../review/review-day';
import { streamDay } from './stream-day';

const MINUTE = 60_000;
const DAY_START = new Date(2026, 10, 19, 10, 0, 0);
const AT = (minute: number) => new Date(DAY_START.getTime() + minute * MINUTE);
const SDK = '/home/human/dev/ethlete-sdk';
const FIFA = '/home/human/dev/fifagg/fifagg-frontend';
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ET', 'FIFAGG'] });
const SDK_RULE: AttributionRule = {
  id: `rule-${SDK}`,
  repoPath: SDK,
  target: { kind: 'issue', issueKey: 'ET-772' },
  author: 'user',
  createdAt: AT(0),
};

const steps = (from: number, to: number, every: number) =>
  Array.from({ length: Math.floor((to - from) / every) + 1 }, (_, step) => from + step * every);

/** The one VS Code window of 2026-11-19: workspace ethlete-sdk, with tmux terminals in both checkouts. */
const terminalHost = (from: number, to: number): CollectedEvent[] =>
  steps(from, to, 5).map((minute) => ({
    at: AT(minute),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'tmux - ethlete-sdk - Visual Studio Code',
  }));

const agent = (options: {
  sessionId: string;
  cwd: string;
  gitBranch: string;
  title: string;
  from: number;
  to: number;
}): CollectedEvent[] =>
  steps(options.from, options.to, 2).flatMap((minute): CollectedEvent[] => [
    {
      at: AT(minute),
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: options.sessionId,
      cwd: options.cwd,
      gitBranch: options.gitBranch,
      title: options.title,
    },
    {
      at: AT(minute),
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: 'claude-code',
      sessionId: options.sessionId,
      turnId: `${options.sessionId}-${minute}`,
      cwd: options.cwd,
      gitBranch: options.gitBranch,
      model: 'claude-opus-5',
      usage: { input: 3, output: 900, cacheWrite: 200, cacheRead: 60_000, thinking: 100 },
    },
  ]);

const commit = (minute: number, repoPath: string, branch: string, subject: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch,
  sha: `sha-${repoPath.length}-${minute}`,
  subject,
});

const BOTH_AGENTS: CollectedEvent[] = [
  ...terminalHost(0, 120),
  ...agent({ sessionId: 'builder', cwd: SDK, gitBranch: 'next', title: 'Builder-night-7 handoff', from: 0, to: 120 }),
  ...agent({
    sessionId: 'fifa',
    cwd: FIFA,
    gitBranch: 'feat/FIFAGG-12769-standings',
    title: 'Standings goals columns',
    from: 0,
    to: 120,
  }),
];

const SDK_COMMITS = [
  commit(30, SDK, 'next', 'fix(repo): Centre the macOS traffic lights'),
  commit(90, SDK, 'next', 'fix(repo): Satisfy clippy on the traffic-light check'),
];

const rowsOf = (options: { events: CollectedEvent[]; rules: AttributionRule[] }) => {
  const day = streamDay({
    events: options.events.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
    options: {
      repoRoots: [SDK, FIFA],
      windowsSeenThroughMs: AT(600).getTime(),
      baseBranches: ['main', 'next'],
      rows: { config: CONFIG, rules: options.rules, dependencies: { [FIFA]: [SDK] } },
    },
  });

  return reviewDay({ rows: day.rows }).rows;
};

describe('streamDay, on one editor window whose terminals run agents in two checkouts', () => {
  const inLane = (repoPath: string) =>
    rowsOf({
      events: [
        ...BOTH_AGENTS,
        ...SDK_COMMITS,
        commit(60, FIFA, 'feat/FIFAGG-12769-standings', 'feat(standings): Add goals columns'),
      ],
      rules: [SDK_RULE],
    }).filter((row) => row.laneKey === `repo:${repoPath}`);

  it('names no row of the library lane after the consumer checkout an agent worked in alongside it', () => {
    const keys = inLane(SDK).flatMap((row) => [row.issueKey, row.withheldIssueKey].filter(Boolean));

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => key?.startsWith('FIFAGG'))).toEqual([]);
  });

  it('keeps each checkout in its own lane', () => {
    expect(inLane(SDK).length).toBeGreaterThan(0);
    expect(inLane(FIFA).length).toBeGreaterThan(0);
  });
});

describe('streamDay, on one ticket two checkouts worked at once', () => {
  const rows = () =>
    rowsOf({
      events: [...BOTH_AGENTS, ...SDK_COMMITS],
      rules: [{ ...SDK_RULE, target: { kind: 'issue', issueKey: 'FIFAGG-12769' } }],
    }).filter((row) => row.issueKey === 'FIFAGG-12769');

  it('describes the row only from the sessions of the checkout its ticket belongs to', () => {
    const described = rows().map((row) => row.description ?? '');

    expect(described.join(' ')).toContain('Standings goals columns');
    expect(described.filter((text) => /Builder-night/.test(text))).toEqual([]);
  });
});
