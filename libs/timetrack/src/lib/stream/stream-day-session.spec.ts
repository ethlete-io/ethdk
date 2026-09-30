import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { reviewDay } from '../review/review-day';
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
  workedIn?: string;
  title?: string;
}): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'agent-session',
    kind: 'agent-session',
    sessionId: options.sessionId,
    cwd: options.cwd ?? REPO,
    gitBranch: options.branchAt?.(options.from + offset) ?? BRANCH,
    ...(options.workedIn ? { workedIn: `${REPO}/${options.workedIn}` } : {}),
    ...(options.title ? { title: options.title } : {}),
  }));

const handoffTurn = (options: { sessionId: string; minutes: number; workedIn: string }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: options.sessionId,
  turnId: `${options.sessionId}-${options.minutes}`,
  cwd: REPO,
  workedIn: `${REPO}/${options.workedIn}`,
  model: 'claude-opus-5',
  usage: { input: 2, output: 289, cacheWrite: 17_421, cacheRead: 18_910, thinking: 0 },
});

const dayOf = (events: CollectedEvent[]) =>
  streamDay({ events, options: { repoRoots: [REPO], baseBranches: ['main'] } });

const blocksOf = (events: CollectedEvent[]) => dayOf(events).blocks.filter((block) => block.context.repoPath === REPO);

const streamOf = (events: CollectedEvent[]) => dayOf(events).streams.find((stream) => stream.repoPath === REPO);

const promptAt = (options: { sessionId: string; minutes: number }): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: options.sessionId,
  promptId: `${options.sessionId}-${options.minutes}`,
  cwd: REPO,
});

/** Every minute the day would write, named or not. */
const bookedMs = (events: CollectedEvent[]) => {
  const { rows } = dayOf(events);

  return [...rows.proposals, ...rows.unnamed].reduce((sum, row) => sum + row.durationMs, 0);
};

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

  it('books the minutes two sessions of one checkout shared once, to the session prompted last', () => {
    const events = [
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
      promptAt({ sessionId: 'one', minutes: 10 }),
      promptAt({ sessionId: 'two', minutes: 60 }),
    ];

    expect(bookedMs(events)).toBe(120 * 60_000);
    expect(streamOf(events)?.engagedMs).toBe((71 + 60) * 60_000);
  });

  it('hangs the title and the prompts of a session that ran beside an older one on its own stretch', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 110, title: 'Older work' }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 80, title: 'Auto mode debug pages' }),
      promptAt({ sessionId: 'two', minutes: 65 }),
    ]);
    const evidenceOf = (session: string) =>
      blocks
        .filter((block) => block.context.session === session)
        .flatMap((block) => block.evidence)
        .filter((evidence) => evidence.kind === 'agent-session' || evidence.kind === 'prompt')
        .map((evidence) => evidence.summary ?? evidence.kind);

    expect(new Set(evidenceOf('two'))).toEqual(new Set(['Auto mode debug pages', 'prompt']));
    expect(new Set(evidenceOf('one'))).toEqual(new Set(['Older work']));
  });

  it('hangs the changeset and the commits a session beside an older one wrote on its own stretch', () => {
    const blocks = blocksOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 110, title: 'Older work' }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 80, title: 'Sounds good' }),
      handoffTurn({ sessionId: 'two', minutes: 65, workedIn: 'libs/core/generators/migration.ts' }),
      handoffTurn({ sessionId: 'two', minutes: 70, workedIn: '.changeset/core-generator-scan-mediums.md' }),
      {
        at: AT(75),
        source: 'git',
        kind: 'git-commit',
        repoPath: REPO,
        branch: BRANCH,
        sha: 'b2fbfb3e7aaaaaaa',
        subject: 'fix(core): Scope the v5 migration',
        paths: ['libs/core/generators/migration.ts', '.changeset/core-generator-scan-mediums.md'],
      },
    ]);
    const summariesOf = (session: string) =>
      blocks
        .filter((block) => block.context.session === session)
        .flatMap((block) => block.evidence)
        .flatMap((evidence) => (evidence.kind === 'prompt' || !evidence.summary ? [] : [evidence.summary]));

    expect(new Set(summariesOf('two'))).toEqual(
      new Set(['Sounds good', 'changeset core generator scan mediums', 'fix(core): Scope the v5 migration']),
    );
  });

  it('describes the row of a session by the commit it made from its shell, in minutes a sibling session kept', () => {
    const shellTurn = (minutes: number, directory: string): CollectedEvent => ({
      at: AT(minutes),
      source: 'agent-usage',
      kind: 'agent-usage',
      provider: 'claude-code',
      sessionId: 'two',
      turnId: `two-${minutes}`,
      cwd: `${REPO}/${directory}`,
      workedIn: `${REPO}/${directory}`,
      model: 'claude-opus-5',
      usage: { input: 2, output: 289, cacheWrite: 17_421, cacheRead: 18_910, thinking: 0 },
    });
    const { rows } = dayOf([
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 110, branchAt: () => 'main', title: 'Older work' }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 100, branchAt: () => 'main', title: 'Sounds good' }),
      promptAt({ sessionId: 'two', minutes: 60 }),
      promptAt({ sessionId: 'one', minutes: 70 }),
      promptAt({ sessionId: 'two', minutes: 85 }),
      shellTurn(72, 'libs/core/generators'),
      {
        at: AT(75),
        source: 'git',
        kind: 'git-commit',
        repoPath: REPO,
        branch: 'main',
        sha: 'b2fbfb3e7aaaaaaa',
        subject: 'fix(core): Scope the v5 migration',
        paths: ['libs/core/generators/migrate-to-v5/migration.ts'],
      },
      handoffTurn({ sessionId: 'two', minutes: 90, workedIn: '' }),
    ]);
    const two = [...rows.proposals, ...rows.unnamed].find((row) =>
      row.evidence.some((evidence) => evidence.summary === 'Sounds good'),
    );

    expect(two?.description).toBe('fix(core): Scope the v5 migration');
  });

  it('books an overlap the user prompted neither session in once, to the older session', () => {
    const events = [
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 10, to: 70 }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 110 }),
    ];

    expect(bookedMs(events)).toBe(120 * 60_000);
  });

  it('joins sessions one after the other in one directory into one piece, and keeps another apart', () => {
    const onMain = { branchAt: () => 'main' };
    const blocks = blocksOf([
      ...sessionRun({ sessionId: 'one', from: 0, to: 30, workedIn: 'src/app/totw/totw.component.ts', ...onMain }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 90, workedIn: 'src/app/totw/totw.store.ts', ...onMain }),
      ...sessionRun({ sessionId: 'three', from: 120, to: 150, workedIn: 'src/app/shop/shop.component.ts', ...onMain }),
    ]);

    expect(blocks.map((block) => [block.context.session, block.context.piece])).toEqual([
      ['one', 'one'],
      ['two', 'one'],
      ['three', 'three'],
    ]);
  });

  it('names the stretches of sessions on a base branch after the directory each worked in', () => {
    const blocks = blocksOf([
      ...sessionRun({ sessionId: 'one', from: 0, to: 60, branchAt: () => 'main', workedIn: 'src/app/totw/a.ts' }),
      ...sessionRun({ sessionId: 'two', from: 30, to: 90, branchAt: () => 'main', workedIn: 'src/app/shop/b.ts' }),
    ]);

    expect(blocks.map((block) => [block.context.session, block.context.workPath])).toEqual([
      ['one', 'src/app/totw'],
      ['two', 'src/app/shop'],
    ]);
  });

  it('leaves the stretches of sessions that all worked in one directory without one', () => {
    const blocks = blocksOf([
      ...sessionRun({ sessionId: 'one', from: 0, to: 60, branchAt: () => 'main', workedIn: 'src/app/totw/a.ts' }),
      ...sessionRun({ sessionId: 'two', from: 30, to: 90, branchAt: () => 'main', workedIn: 'src/app/totw/b.ts' }),
    ]);

    expect(blocks.map((block) => block.context.workPath)).toEqual([undefined, undefined]);
  });

  it('keeps the unnamed rows of two pieces apart, and joins the sessions of one piece into one row', () => {
    const rowsOf = (events: CollectedEvent[]) =>
      dayOf(events).rows.unattributed.map((row) => [...new Set(row.blocks.map((block) => block.context.session))]);

    expect(
      rowsOf([
        ...sessionRun({ sessionId: 'one', from: 0, to: 60, branchAt: () => 'main', workedIn: 'src/app/totw/a.ts' }),
        ...sessionRun({ sessionId: 'two', from: 70, to: 120, branchAt: () => 'main', workedIn: 'src/app/shop/b.ts' }),
      ]),
    ).toEqual([['one'], ['two']]);
    expect(
      rowsOf([
        ...sessionRun({ sessionId: 'one', from: 0, to: 60, branchAt: () => 'main', workedIn: 'src/app/totw/a.ts' }),
        ...sessionRun({ sessionId: 'two', from: 70, to: 120, branchAt: () => 'main', workedIn: 'src/app/totw/b.ts' }),
      ]),
    ).toEqual([['one', 'two']]);
  });

  it('joins short sessions one after the other on one feature branch into one row', () => {
    const events = [
      ...sessionRun({ sessionId: 'one', from: 0, to: 5, workedIn: 'src/app/totw/a.ts' }),
      ...sessionRun({ sessionId: 'two', from: 6, to: 11, workedIn: 'src/app/shop/b.ts' }),
      ...sessionRun({ sessionId: 'three', from: 12, to: 17 }),
    ];
    const { rows } = dayOf(events);

    expect([...rows.proposals, ...rows.unnamed]).toHaveLength(1);
    expect(bookedMs(events)).toBe(30 * 60_000);
  });

  it('reads a working directory the shell changed into as a directory', () => {
    const blocks = blocksOf([
      ...sessionRun({ sessionId: 'one', from: 0, to: 30, cwd: `${REPO}/libs/timetrack`, workedIn: 'libs/timetrack' }),
      ...sessionRun({ sessionId: 'two', from: 60, to: 90, workedIn: 'libs/timetrack/a.ts' }),
    ]);

    expect(blocks.map((block) => [block.context.session, block.context.piece])).toEqual([
      ['one', 'one'],
      ['two', 'one'],
    ]);
  });

  it('joins parallel sessions through a handoff only a usage turn wrote', () => {
    const blocks = blocksOf([
      ...sessionRun({ sessionId: 'one', from: 0, to: 60 }),
      ...sessionRun({ sessionId: 'two', from: 30, to: 90 }),
      handoffTurn({ sessionId: 'one', minutes: 20, workedIn: '.claude/handoffs/one.md' }),
      handoffTurn({ sessionId: 'two', minutes: 40, workedIn: '.claude/handoffs/one.md' }),
    ]);

    expect(blocks.map((block) => [block.context.session, block.context.piece])).toEqual([
      ['one', 'one'],
      ['two', 'one'],
    ]);
  });

  describe('two sessions of two pieces on one ticket', () => {
    const branchAt = () => 'feature/ET-772-parallel-work';
    const events = [
      ...focusRun({ from: 0, to: 120 }),
      ...sessionRun({ sessionId: 'one', from: 0, to: 120, branchAt }),
      ...sessionRun({ sessionId: 'two', from: 0, to: 120, branchAt }),
      ...[0, 30, 60, 90].map((minutes) => promptAt({ sessionId: 'one', minutes })),
      ...[15, 45, 75, 105].map((minutes) => promptAt({ sessionId: 'two', minutes })),
    ];
    const minutesOf = (rows: readonly { durationMs: number }[]) =>
      rows.map((row) => row.durationMs / 60_000).sort((a, b) => a - b);

    it('are two rows that each book their own minutes, so the pair books the wall clock once', () => {
      const booked = dayOf(events).rows.proposals.filter((row) => row.issueKey === 'ET-772');

      expect(booked).toHaveLength(2);
      expect(minutesOf(booked)).toEqual([60, 60]);
    });

    it('still book the wall clock once after the review, including a pair the reviewer edited', () => {
      const { rows } = dayOf(events);
      const review = reviewDay({
        rows,
        edits: {
          overrides: Object.fromEntries(rows.proposals.map((row) => [row.id, { description: 'parallel work' }])),
          pinned: [],
          statements: [],
        },
      });
      const booked = review.rows.filter((row) => row.issueKey === 'ET-772');

      expect(minutesOf(booked)).toEqual([60, 60]);
      expect(review.check.warnings.map((warning) => warning.kind)).not.toContain('rows-overlap');
    });
  });

  it('keeps a session one row on its ticket across the stretches its parallel sessions took from it', () => {
    const branchAt = () => 'feature/ET-772-parallel-work';
    const { rows } = dayOf([
      ...focusRun({ from: 0, to: 60 }),
      ...['one', 'two', 'three'].flatMap((sessionId) => sessionRun({ sessionId, from: 0, to: 60, branchAt })),
      promptAt({ sessionId: 'one', minutes: 0 }),
      promptAt({ sessionId: 'two', minutes: 5 }),
      promptAt({ sessionId: 'three', minutes: 15 }),
      promptAt({ sessionId: 'one', minutes: 35 }),
    ]);
    const booked = rows.proposals.filter((row) => row.issueKey === 'ET-772');

    expect(booked).toHaveLength(3);
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
