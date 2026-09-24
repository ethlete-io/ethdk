import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const MAIN = '/home/tom/dev/fut-frontend';
const WORKTREE = '/home/tom/dev/fut-frontend-altcha';
const MAIN_BRANCH = 'fix/security-audit-general';
const WORKTREE_BRANCH = 'feat/login-altcha';

const AT = (minutes: number) => new Date(Date.UTC(2026, 8, 23, 15, 0, 0) + minutes * 60_000);

const minutesOf = (options: { from: number; to: number }) =>
  Array.from({ length: options.to - options.from + 1 }, (_, index) => options.from + index);

const sessionRun = (options: {
  sessionId: string;
  from: number;
  to: number;
  workedIn?: (minutes: number) => string | undefined;
}): CollectedEvent[] =>
  minutesOf(options).map((minutes) => {
    const workedIn = options.workedIn?.(minutes);

    return {
      at: AT(minutes),
      source: 'agent-session',
      kind: 'agent-session',
      sessionId: options.sessionId,
      cwd: MAIN,
      gitBranch: 'next',
      ...(workedIn ? { workedIn } : {}),
    };
  });

const commit = (options: { minutes: number; repoPath: string; branch: string }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath: options.repoPath,
  branch: options.branch,
  sha: `${options.repoPath}-${options.minutes}`,
  subject: 'feat(auth): Put a captcha in front of the login',
});

const turn = (options: { minutes: number; workedIn: string }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: 'altcha',
  turnId: `turn-${options.minutes}`,
  cwd: MAIN,
  gitBranch: 'next',
  workedIn: options.workedIn,
  model: 'claude-opus-5',
  usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0, thinking: 0 },
});

const dayOf = (events: CollectedEvent[]) => streamDay({ events, options: { repoRoots: [MAIN, WORKTREE] } });

const spansOf = (events: CollectedEvent[]) =>
  dayOf(events)
    .blocks.filter((block) => block.context.repoPath)
    .map((block) => ({
      repoPath: block.context.repoPath,
      branch: block.context.branch,
      from: block.from.toISOString(),
      to: block.to.toISOString(),
    }));

const commits = [
  commit({ minutes: 0, repoPath: MAIN, branch: MAIN_BRANCH }),
  commit({ minutes: 40, repoPath: WORKTREE, branch: WORKTREE_BRANCH }),
];

describe('streamDay, on where an agent worked', () => {
  it('files a session that worked in another checkout there, on that checkout’s own branch', () => {
    const spans = spansOf([
      ...commits,
      ...sessionRun({ sessionId: 'main', from: 0, to: 40, workedIn: () => `${MAIN}/libs/upload.ts` }),
      ...sessionRun({ sessionId: 'altcha', from: 10, to: 40, workedIn: () => `${WORKTREE}/libs/login.ts` }),
    ]);

    expect(spans).toContainEqual({
      repoPath: WORKTREE,
      branch: WORKTREE_BRANCH,
      from: AT(10).toISOString(),
      to: AT(40).toISOString(),
    });
    expect(spans.filter((span) => span.repoPath === MAIN).map((span) => [span.from, span.to])).toEqual([
      [AT(0).toISOString(), AT(40).toISOString()],
    ]);
  });

  it('follows one session from checkout to checkout as it moves', () => {
    const spans = spansOf([
      ...commits,
      ...sessionRun({
        sessionId: 'one',
        from: 0,
        to: 40,
        workedIn: (minutes) => (minutes >= 20 ? WORKTREE : MAIN),
      }),
    ]);

    expect(spans.map((span) => [span.repoPath, span.from, span.to])).toEqual([
      [MAIN, AT(0).toISOString(), AT(20).toISOString()],
      [WORKTREE, AT(20).toISOString(), AT(40).toISOString()],
    ]);
  });

  it('leaves a session in its working directory for a path no known checkout holds', () => {
    const spans = spansOf([
      ...commits,
      ...sessionRun({ sessionId: 'one', from: 0, to: 40, workedIn: () => '/tmp/altcha-check/login.png' }),
    ]);

    expect(spans.map((span) => span.repoPath)).toEqual([MAIN]);
  });

  it('drops the samples an older read of a session stored once a re-read has placed that session', () => {
    const spans = spansOf([
      ...commits,
      ...sessionRun({ sessionId: 'altcha', from: 0, to: 5 }),
      ...sessionRun({ sessionId: 'altcha', from: 10, to: 40 }),
      ...sessionRun({ sessionId: 'altcha', from: 10, to: 40, workedIn: () => WORKTREE }).map((event) => ({
        ...event,
        at: new Date(event.at.getTime() + 30_000),
      })),
    ]);

    expect(spans.map((span) => span.repoPath)).toEqual([MAIN, WORKTREE]);
    expect(spans.find((span) => span.repoPath === MAIN)?.to).toBe(new Date(AT(10).getTime() + 30_000).toISOString());
  });

  it('carries a turn’s spend into the checkout it worked in', () => {
    const day = dayOf([
      ...commits,
      ...sessionRun({ sessionId: 'altcha', from: 10, to: 40, workedIn: () => WORKTREE }),
      turn({ minutes: 20, workedIn: WORKTREE }),
    ]);

    expect(day.streams.find((stream) => stream.repoPath === WORKTREE)?.spend.turns).toBe(1);
  });
});
