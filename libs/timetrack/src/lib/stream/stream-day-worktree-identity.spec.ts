import { describe, expect, it } from 'vitest';
import { foldWorktreePaths, unknownCommitCheckoutsOf } from '../git/worktree';
import { repoRootOf } from '../model/context';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const SDK = '/home/human/dev/ethlete-sdk';
const WT = '/home/human/dev/ethlete-sdk-wt-a32';
const WT_LONGER = '/home/human/dev/ethlete-sdk-wt-a32b';
const WORKTREES = { [WT]: SDK };

const AT = (minutes: number) => new Date(new Date(2026, 10, 20, 9, 0, 0).getTime() + minutes * 60_000);

const focusRun = (from: number, to: number): CollectedEvent[] =>
  Array.from({ length: to - from + 1 }, (_, offset) => ({
    at: AT(from + offset),
    source: 'window' as const,
    kind: 'window-focus' as const,
    appId: 'kitty',
    title: 'claude',
  }));

const sessionRun = (options: { from: number; to: number; cwd: string; sessionId: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session' as const,
    kind: 'agent-session' as const,
    sessionId: options.sessionId,
    cwd: options.cwd,
    gitBranch: 'wt-a32',
  }));

const commit = (minutes: number, repoPath: string, sha: string): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch: 'wt-a32',
  sha,
  subject: `fix: ${sha}`,
});

const repoStreamsOf = (events: CollectedEvent[]) =>
  streamDay({ events, options: { repoRoots: [SDK, WT], rows: { worktrees: WORKTREES } } })
    .streams.map((stream) => stream.key)
    .filter((key) => key.startsWith('repo:'));

describe('a linked worktree is its main repository', () => {
  it('files a session and a commit in a worktree under the main checkout, as one lane', () => {
    const events = [
      ...focusRun(0, 40),
      ...sessionRun({ from: 0, to: 20, cwd: SDK, sessionId: 'main' }),
      ...sessionRun({ from: 10, to: 40, cwd: `${WT}/libs/cli`, sessionId: 'builder' }),
      commit(30, WT, 'aaaa'),
    ];

    expect(repoStreamsOf(events)).toEqual([`repo:${SDK}`]);
  });

  it('resolves a path inside a worktree, also one deleted since, to its main checkout', () => {
    const roots = { paths: [SDK, WT], worktrees: WORKTREES };

    expect(repoRootOf({ path: `${WT}/libs/cli`, roots })).toBe(SDK);
    expect(repoRootOf({ path: `${WT}/libs/cli`, roots: { paths: [], worktrees: WORKTREES } })).toBe(SDK);
  });

  it('leaves a sibling checkout whose name only starts with the worktree name alone', () => {
    const events = [...focusRun(0, 20), ...sessionRun({ from: 0, to: 20, cwd: WT_LONGER, sessionId: 'other' })];

    expect(repoStreamsOf(events)).toEqual([`repo:${WT_LONGER}`]);
  });

  it('folds stored review edits that name a worktree lane onto the main lane', () => {
    const edits = {
      overrides: { [`unnamed:repo:${WT}@2026-11-20T21:15:00.000Z`]: { issueKey: 'ET-1' } },
      pinned: [{ context: { repoPath: `${WT}/` } }],
    };

    expect(foldWorktreePaths(edits, WORKTREES)).toEqual({
      overrides: { [`unnamed:repo:${SDK}@2026-11-20T21:15:00.000Z`]: { issueKey: 'ET-1' } },
      pinned: [{ context: { repoPath: `${SDK}/` } }],
    });
  });

  it('names a deleted checkout a stored commit points at, with a commit to look it up by', () => {
    const found = unknownCommitCheckoutsOf({
      events: [commit(0, SDK, 'aaaa'), commit(1, WT, 'bbbb'), commit(2, WT, 'cccc')],
      known: new Set([SDK]),
    });

    expect([...found]).toEqual([[WT, 'bbbb']]);
  });
});
