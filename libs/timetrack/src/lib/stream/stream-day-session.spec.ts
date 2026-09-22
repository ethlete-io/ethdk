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

const sessionRun = (options: {
  sessionId: string;
  from: number;
  to: number;
  cwd?: string;
  branchAt?: (minutes: number) => string;
}): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId,
    cwd: options.cwd ?? REPO,
    gitBranch: options.branchAt?.(options.from + offset) ?? BRANCH,
  }));

const dayOf = (events: CollectedEvent[]) =>
  streamDay({ events, options: { repoRoots: [REPO], baseBranches: ['main'] } });

const blocksOf = (events: CollectedEvent[]) => dayOf(events).blocks.filter((block) => block.context.repoPath === REPO);

const streamOf = (events: CollectedEvent[]) => dayOf(events).streams.find((stream) => stream.repoPath === REPO);

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

  it('draws two sessions that ran at the same time as two stretches that overlap', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
    ]);

    expect(blocks.map((block) => block.context.session)).toEqual(['one', 'two']);
    expect(blocks[1]?.from.getTime()).toBe(AT(60).getTime());
    expect(blocks[0]?.to.getTime()).toBeGreaterThan(blocks[1]?.from.getTime() ?? 0);
  });

  it('books the minutes two sessions of one checkout shared to each of them', () => {
    const stream = streamOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
    ]);

    expect(stream?.from.getTime()).toBe(AT(0).getTime());
    expect(stream?.to.getTime()).toBe(AT(120).getTime());
    expect(stream?.engagedMs).toBe((71 + 60) * 60_000);
  });

  it('leaves a checkout that ran one session at a time booking its minutes once', () => {
    const stream = streamOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 50 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 100 }),
    ]);

    expect(stream?.engagedMs).toBe(120 * 60_000);
  });

  it('gives the focused window of an instant two sessions ran in to the one that started first', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
    ]);

    expect(blocks[0]?.from.getTime()).toBe(AT(0).getTime());
    expect(blocks[0]?.to.getTime()).toBe(AT(71).getTime());
    expect(blocks[1]?.to.getTime()).toBe(AT(120).getTime());
  });

  it('leaves a checkout that ran no session on the key it always had', () => {
    const blocks = blocksOf(focusRun({ from: 0, to: 60 }));

    expect(blocks.map((block) => block.context.session)).toEqual([undefined]);
  });

  it('leaves a session that switched branch twice as one stretch, named after the branch it spent longest on', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({
        sessionId: 'one',
        from: 10,
        to: 110,
        branchAt: (minutes) => (minutes < 20 || minutes >= 100 ? 'dev-tappp-finals' : 'next'),
      }),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.context.branch).toBe('next');
  });
});
