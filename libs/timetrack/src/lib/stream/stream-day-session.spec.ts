import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { streamDay } from './stream-day';

const REPO = '/home/tom/dev/fut-frontend';
const BRANCH = 'fix/totw-16-9-special-layout';

const AT = (minutes: number) => new Date(new Date(2026, 8, 22, 10, 0, 0).getTime() + minutes * 60_000);

const focusRun = (options: { from: number; to: number }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'window',
    kind: 'window-focus',
    appId: 'code',
    title: 'totw.component.ts - fut-frontend - Code',
  }));

const sessionRun = (options: { sessionId: string; from: number; to: number; cwd?: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId,
    cwd: options.cwd ?? REPO,
    gitBranch: BRANCH,
  }));

const blocksOf = (events: CollectedEvent[]) =>
  streamDay({ events, options: { repoRoots: [REPO], baseBranches: ['main'] } }).blocks.filter(
    (block) => block.context.repoPath === REPO,
  );

describe('streamDay agent sessions', () => {
  it('names every stretch of a checkout after the one session it ran, including the minutes around it', () => {
    const blocks = blocksOf([...focusRun({ from: 0, to: 120 }), ...sessionRun({ sessionId: 'one', from: 20, to: 80 })]);

    expect(blocks.map((block) => block.context.session)).toEqual(['one']);
    expect(blocks[0]?.from.getTime()).toBe(AT(0).getTime());
    expect(blocks[0]?.to.getTime()).toBe(AT(120).getTime());
  });

  it('cuts a checkout that ran two sessions one after the other into one stretch each', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 50 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 100 }),
    ]);

    expect(blocks.map((block) => block.context.session)).toEqual(['one', 'two']);
    expect(blocks[0]?.to.getTime()).toBe(blocks[1]?.from.getTime());
  });

  it('gives an instant two sessions both ran in to the one that started first', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
    ]);

    expect(blocks.map((block) => block.context.session)).toEqual(['one', 'two']);
    expect(blocks[1]?.from.getTime()).toBe(AT(71).getTime());
    expect(blocks[0]?.to.getTime()).toBeLessThanOrEqual(blocks[1]?.from.getTime() ?? 0);
  });

  it('leaves a checkout that ran no session on the key it always had', () => {
    const blocks = blocksOf(focusRun({ from: 0, to: 60 }));

    expect(blocks.map((block) => block.context.session)).toEqual([undefined]);
  });
});
