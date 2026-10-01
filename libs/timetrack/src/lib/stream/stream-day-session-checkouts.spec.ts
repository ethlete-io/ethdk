import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { reviewDay } from '../review/review-day';
import { streamDay } from './stream-day';

const APP = '/home/dev/app-a';
const SPECS = '/home/dev/app-a-specs';

const AT = (minutes: number) => new Date(new Date(2026, 9, 1, 10, 0, 0).getTime() + minutes * 60_000);

const sessionRun = (options: {
  sessionId: string;
  repoPath: string;
  from: number;
  to: number;
  workedIn: string;
}): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId,
    cwd: options.repoPath,
    gitBranch: 'main',
    workedIn: `${options.repoPath}/${options.workedIn}`,
  }));

const steered = (options: {
  sessionId: string;
  cwd: string;
  from: number;
  to: number;
  workedIn: (minutes: number) => string;
}): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => options.from + offset).flatMap(
    (minutes): CollectedEvent[] => [
      {
        at: AT(minutes),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: options.sessionId,
        cwd: options.cwd,
        gitBranch: 'main',
        workedIn: options.workedIn(minutes),
      },
      {
        at: AT(minutes),
        source: 'agent-prompt',
        kind: 'agent-prompt',
        provider: 'claude-code',
        promptId: `${options.sessionId}-${minutes}`,
        sessionId: options.sessionId,
        cwd: options.cwd,
        gitBranch: 'main',
      },
    ],
  );

const bookedByLane = (events: CollectedEvent[]) => {
  const day = streamDay({ events, options: { repoRoots: [APP, SPECS], baseBranches: ['main'] } });
  const rows = reviewDay({ rows: day.rows }).rows;
  const booked = (laneKey: string) =>
    rows.filter((row) => row.laneKey === laneKey).reduce((sum, row) => sum + row.durationMs / 60_000, 0);
  const overlapping = rows.some((row) =>
    rows.some((other) => other !== row && other.from < row.to && row.from < other.to),
  );

  return { app: booked(`repo:${APP}`), specs: booked(`repo:${SPECS}`), overlapping };
};

describe('streamDay agent sessions in two checkouts', () => {
  it('books each minute once for one session that moves between two repositories and back', () => {
    const booked = bookedByLane(
      steered({
        sessionId: 'one',
        cwd: APP,
        from: 0,
        to: 60,
        workedIn: (minutes) => (minutes >= 20 && minutes < 35 ? `${SPECS}/docs/spec.md` : `${APP}/src/a.ts`),
      }),
    );

    expect(booked).toEqual({ app: 45, specs: 15, overlapping: false });
  });

  it('books both repositories where two sessions ran in them at once', () => {
    const booked = bookedByLane([
      ...steered({ sessionId: 'one', cwd: APP, from: 0, to: 60, workedIn: () => `${APP}/src/a.ts` }),
      ...steered({ sessionId: 'two', cwd: SPECS, from: 16, to: 29, workedIn: () => `${SPECS}/docs/spec.md` }),
    ]);

    expect(booked).toEqual({ app: 60, specs: 15, overlapping: true });
  });

  it('keeps the piece a session has in one checkout when it also worked in another', () => {
    const { blocks } = streamDay({
      events: [
        ...sessionRun({ sessionId: 'one', repoPath: APP, from: 0, to: 30, workedIn: 'src/app/shop/a.ts' }),
        ...sessionRun({ sessionId: 'two', repoPath: APP, from: 60, to: 90, workedIn: 'src/app/shop/b.ts' }),
        ...sessionRun({ sessionId: 'two', repoPath: SPECS, from: 95, to: 100, workedIn: 'docs/shop/spec.md' }),
        ...sessionRun({ sessionId: 'three', repoPath: APP, from: 120, to: 150, workedIn: 'src/app/shop/c.ts' }),
      ],
      options: { repoRoots: [APP, SPECS], baseBranches: ['main'] },
    });

    expect(
      blocks
        .filter((block) => block.context.repoPath === APP)
        .map((block) => [block.context.session, block.context.piece]),
    ).toEqual([
      ['one', 'one'],
      ['two', 'one'],
      ['three', 'one'],
    ]);
  });
});
