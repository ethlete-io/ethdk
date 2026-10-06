import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const REPO = '/home/tom/dev/fut-frontend';
const FEATURE = 'fix/security-audit-general';

const AT = (minutes: number) => new Date(Date.UTC(2026, 8, 23, 14, 0, 0) + minutes * 60_000);

const everyMinute = (options: { from: number; to: number; step?: number }) =>
  Array.from(
    { length: Math.floor((options.to - options.from) / (options.step ?? 1)) + 1 },
    (_, index) => options.from + index * (options.step ?? 1),
  );

const focusRun = (options: { from: number; to: number }): CollectedEvent[] =>
  everyMinute(options).map((minutes) => ({
    at: AT(minutes),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'upload.component.ts - fut-frontend - Visual Studio Code',
  }));

const heartbeats = (options: { from: number; to: number; branch: string }): CollectedEvent[] =>
  everyMinute({ ...options, step: 5 }).map((minutes) => ({
    at: AT(minutes),
    source: 'editor',
    kind: 'editor-heartbeat',
    reporter: 'vscode',
    repoPath: REPO,
    branch: options.branch,
    editing: true,
  }));

const sessionRun = (options: {
  sessionId: string;
  from: number;
  to: number;
  branch: string;
  cwd?: string;
}): CollectedEvent[] =>
  everyMinute(options).map((minutes) => ({
    at: AT(minutes),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId,
    cwd: options.cwd ?? REPO,
    gitBranch: options.branch,
  }));

const checkout = (options: { minutes: number; branch: string }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'git',
  kind: 'git-checkout',
  repoPath: REPO,
  branch: options.branch,
});

const dayOf = (events: CollectedEvent[], worktrees: Record<string, string> = {}) =>
  streamDay({
    events: [...events].sort((a, b) => a.at.getTime() - b.at.getTime()),
    options: { repoRoots: [REPO], baseBranches: ['main', 'next'], rows: { worktrees } },
  });

const blocksOf = (events: CollectedEvent[], worktrees: Record<string, string> = {}) =>
  dayOf(events, worktrees).blocks.filter((block) => block.context.repoPath === REPO);

const branchesBetween = (blocks: ReturnType<typeof blocksOf>, from: number, to: number) => [
  ...new Set(
    blocks
      .filter((block) => block.from.getTime() < AT(to).getTime() && block.to.getTime() > AT(from).getTime())
      .map((block) => block.context.branch),
  ),
];

describe('streamDay branch precedence', () => {
  it('keeps the branch git and the editor name while agent sessions in the checkout report another', () => {
    const blocks = blocksOf([
      checkout({ minutes: 0, branch: FEATURE }),
      ...focusRun({ from: 0, to: 165 }),
      ...heartbeats({ from: 0, to: 165, branch: FEATURE }),
      ...sessionRun({ sessionId: 'audit', from: 0, to: 112, branch: FEATURE }),
      ...sessionRun({ sessionId: 'f93bd7d0', from: 86, to: 112, branch: 'next' }),
      ...sessionRun({ sessionId: '496bad18', from: 86, to: 111, branch: 'next' }),
    ]);

    expect(branchesBetween(blocks, 0, 165)).toEqual([FEATURE]);
    expect(branchesBetween(blocks, 105, 150)).toEqual([FEATURE]);
    expect(branchesBetween(blocks, 150, 165)).toEqual([FEATURE]);
  });

  it('lets an agent session name the branch where neither git nor an editor has said one', () => {
    const day = dayOf([
      ...focusRun({ from: 0, to: 60 }),
      ...sessionRun({ sessionId: 'one', from: 0, to: 30, branch: FEATURE }),
      ...heartbeats({ from: 40, to: 60, branch: 'fix/other' }),
    ]);

    expect(day.streams.find((stream) => stream.repoPath === REPO)?.branches).toEqual([FEATURE, 'fix/other']);
  });

  it('follows a later checkout over the branch the agent keeps reporting', () => {
    const blocks = blocksOf([
      checkout({ minutes: 0, branch: FEATURE }),
      ...focusRun({ from: 0, to: 60 }),
      ...sessionRun({ sessionId: 'one', from: 0, to: 60, branch: FEATURE }),
      checkout({ minutes: 10, branch: 'fix/other' }),
    ]);

    expect(branchesBetween(blocks, 0, 60)).toEqual(['fix/other']);
  });

  it("keeps the branch a session in a worktree inside the checkout reports over the checkout's own switch", () => {
    const worktree = `${REPO}/.claude/worktrees/bracket`;
    const blocks = blocksOf(
      [
        checkout({ minutes: 0, branch: FEATURE }),
        ...sessionRun({ sessionId: 'main', from: 0, to: 30, branch: FEATURE }),
        ...sessionRun({
          sessionId: 'worktree',
          from: 0,
          to: 30,
          branch: 'fix/bracket',
          cwd: `${worktree}/libs/bracket`,
        }),
      ],
      { [worktree]: REPO },
    );
    const sessionBranches = (session: string) => [
      ...new Set(blocks.filter((block) => block.context.session === session).map((block) => block.context.branch)),
    ];

    expect(sessionBranches('worktree')).toEqual(['fix/bracket']);
    expect(sessionBranches('main')).toEqual([FEATURE]);
  });
});
