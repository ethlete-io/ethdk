import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const MAIN = '/home/human/dev/app';
const WORKTREE = '/home/human/dev/app-wt1';
const at = (time: string) => new Date(`2026-11-21T${time}:00Z`);
const times = ['10:00', '10:05', '10:10', '10:15', '10:20'];
const commit = (options: { time: string; repoPath: string; sha: string; change: number }) =>
  ({
    at: at(options.time),
    source: 'git',
    kind: 'git-commit',
    repoPath: options.repoPath,
    sha: options.sha.padEnd(40, '0'),
    branch: 'feature',
    subject: `fix(app): Change ${options.change}`,
    paths: [],
  }) as CollectedEvent;

const events = [
  { at: at('09:50'), source: 'input', kind: 'input-active' },
  ...['10:00', '10:04', '10:08', '10:12', '10:16', '10:20', '10:24'].map((time) => ({
    at: at(time),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: 'session-1',
    cwd: MAIN,
    workedIn: `${MAIN}/`,
    gitBranch: 'feature',
  })),
  ...times.map((time, change) => commit({ time, repoPath: MAIN, sha: `a${change}`, change })),
  ...times.map((time, change) => commit({ time, repoPath: WORKTREE, sha: `b${change}`, change })),
  { at: at('10:40'), source: 'input', kind: 'input-idle' },
] as CollectedEvent[];

const rowsOf = (options: { events: readonly CollectedEvent[]; worktrees: Record<string, string> }) => {
  const day = streamDay({
    events: options.events,
    options: { repoRoots: [MAIN], rows: { worktrees: options.worktrees } },
  });

  return [...day.rows.proposals, ...day.rows.unnamed];
};

describe('the cherry-picked copies of a commit in a worktree', () => {
  it('fold into the main checkout lane with the commits of the worktree and count their minutes once', () => {
    const rows = rowsOf({
      events: [...events, commit({ time: '10:25', repoPath: WORKTREE, sha: 'c', change: 9 })],
      worktrees: { [WORKTREE]: MAIN },
    });

    expect(rows.map((row) => row.laneKey)).toEqual([`repo:${MAIN}`]);
    expect(rows.reduce((sum, row) => sum + row.durationMs, 0)).toBe(30 * 60_000);
  });

  it('leave no row behind that kept none of its evidence once the copies stay in another row', () => {
    const rows = rowsOf({ events, worktrees: {} });

    expect(rows.map((row) => row.laneKey)).toEqual([`repo:${MAIN}`]);
    expect(rows.reduce((sum, row) => sum + row.durationMs, 0)).toBe(30 * 60_000);
  });
});
