import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
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

describe('streamDay agent sessions in two checkouts', () => {
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
