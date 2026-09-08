import { describe, expect, it } from 'vitest';
import { CollectedEvent, TokenUsage } from '../model/event';
import { OTHER_APPLICATIONS_KEY, streamDay } from './stream-day';

const SDK = '/home/tom/dev/ethlete-sdk';
const FUT = '/home/tom/dev/fut-frontend';

const AT = (minutes: number) => new Date(new Date(2026, 7, 12, 9, 0, 0).getTime() + minutes * 60_000);

const MINUTE = 60_000;

const focus = (minutes: number, appId: string, title = appId): CollectedEvent => ({
  at: AT(minutes),
  source: 'window',
  kind: 'window-focus',
  appId,
  title,
});

const commit = (minutes: number, subject: string, repoPath = SDK): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch: 'next',
  sha: 'abc1234def',
  subject,
});

const checkout = (minutes: number, branch: string, repoPath = SDK): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-checkout',
  repoPath,
  branch,
});

const session = (minutes: number, cwd: string, sessionId = `session-${minutes}`): CollectedEvent => ({
  at: AT(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId,
  cwd,
  gitBranch: 'next',
});

const presence = (minutes: number, kind: 'idle-start' | 'idle-end' | 'lock' | 'unlock'): CollectedEvent => ({
  at: AT(minutes),
  source: 'idle',
  kind,
});

const usage = (minutes: number, cwd: string, counts: Partial<TokenUsage> = {}): CollectedEvent => ({
  at: AT(minutes),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: 'session-1',
  turnId: `turn-${minutes}`,
  cwd,
  model: 'claude-opus-5',
  usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0, ...counts },
});

/** A minute-by-minute focus run, so presence covers the stretch the way a real day's samples do. */
const focusRun = (options: { from: number; to: number; appId: string; title?: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) =>
    focus(options.from + offset, options.appId, options.title),
  );

const sessionRun = (options: { from: number; to: number; cwd: string; sessionId?: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) =>
    session(options.from + offset, options.cwd, options.sessionId),
  );

const streamOf = (day: ReturnType<typeof streamDay>, key: string) => day.streams.find((stream) => stream.key === key);

describe('streamDay', () => {
  it('gives the focused window its time, by the checkout its title names', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 30, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.streams).toHaveLength(1);
    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(30 * MINUTE);
    expect(streamOf(day, `repo:${SDK}`)?.apps).toEqual(['code']);
    expect(day.presenceMs).toBe(30 * MINUTE);
    expect(day.concurrency).toBe(1);
  });

  it('folds every application with no checkout into one line', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'slack' }),
        ...focusRun({ from: 10, to: 20, appId: 'firefox' }),
        ...focusRun({ from: 20, to: 30, appId: 'spotify' }),
      ],
    });

    expect(day.streams).toHaveLength(1);

    const folded = streamOf(day, OTHER_APPLICATIONS_KEY);

    expect(folded?.apps).toEqual(['slack', 'firefox', 'spotify']);
    expect(folded?.engagedMs).toBe(30 * MINUTE);
    expect(folded?.repoPath).toBeUndefined();
  });

  it('books a checkout an agent ran in, and says nobody ever looked at it', () => {
    const day = streamDay({
      events: [...focusRun({ from: 0, to: 30, appId: 'slack' }), ...sessionRun({ from: 5, to: 25, cwd: FUT })],
      options: { repoRoots: [FUT] },
    });

    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.neverFocused).toBe(false);

    const agentOnly = streamOf(day, `repo:${FUT}`);

    expect(agentOnly?.neverFocused).toBe(true);
    expect(agentOnly?.engagedMs).toBe(20 * MINUTE);
    expect(day.engagedMs).toBe(50 * MINUTE);
    expect(day.concurrency).toBeCloseTo(50 / 30);
  });

  it('counts five consoles in one checkout as one stream, and sums only their spend', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'slack' }),
        ...[1, 2, 3, 4, 5].flatMap((console) =>
          sessionRun({ from: 0, to: 20, cwd: SDK, sessionId: `console-${console}` }),
        ),
        ...[1, 2, 3, 4, 5].map((console) => usage(10, SDK, { output: 1_000 * console })),
      ],
      options: { repoRoots: [SDK] },
    });

    const stream = streamOf(day, `repo:${SDK}`);

    expect(stream?.blocks).toHaveLength(1);
    expect(stream?.engagedMs).toBe(20 * MINUTE);
    expect(stream?.spend.turns).toBe(5);
    expect(stream?.spend.usage.output).toBe(15_000);
  });

  it('counts no time while the user is away, whatever the agents did', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        presence(10, 'idle-start'),
        ...sessionRun({ from: 11, to: 60, cwd: SDK }),
        presence(61, 'idle-end'),
        ...focusRun({ from: 61, to: 70, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.presenceMs).toBe(19 * MINUTE);
    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(19 * MINUTE);
  });

  it('lets the span disagree with the engaged time when a stream has a gap', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        presence(10, 'lock'),
        presence(120, 'unlock'),
        ...focusRun({ from: 120, to: 130, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    const stream = streamOf(day, `repo:${SDK}`);

    expect(stream?.blocks).toHaveLength(2);
    expect(stream?.from).toEqual(AT(0));
    expect(stream?.to).toEqual(AT(130));
    expect(stream?.engagedMs).toBe(20 * MINUTE);
  });

  it('keeps one stream for a checkout that switched branch, and lists both branches', () => {
    const day = streamDay({
      events: [
        checkout(0, 'next'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        checkout(10, 'main'),
        ...focusRun({ from: 10, to: 20, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.streams).toHaveLength(1);
    expect(streamOf(day, `repo:${SDK}`)?.branches).toEqual(['next', 'main']);
    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(20 * MINUTE);
  });

  it('holds the checkout for a title that names none, until the stickiness runs out', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 30, appId: 'firefox', title: 'localhost:4200 — Firefox' }),
      ],
      options: { repoRoots: [SDK], repoStickinessMs: 5 * MINUTE },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(6 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(24 * MINUTE);
  });

  it('leaves spend no stream was running for out of every line, and still reports it', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        usage(5, SDK, { output: 400 }),
        usage(300, SDK, { output: 700 }),
        usage(6, FUT, { output: 900 }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.spend.usage.output).toBe(400);
    expect(day.unattributedSpend.usage.output).toBe(1_600);
    expect(day.spend.usage.output).toBe(2_000);
    expect(day.spend.turns).toBe(3);
    expect(day.spend.models).toEqual(['claude-opus-5']);
  });

  it('reads nothing from a day nothing observed', () => {
    const day = streamDay({ events: [] });

    expect(day).toEqual({
      presenceMs: 0,
      engagedMs: 0,
      concurrency: 0,
      streams: [],
      spend: { usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 }, turns: 0, models: [] },
      unattributedSpend: {
        usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 },
        turns: 0,
        models: [],
      },
    });
  });

  it('sums every stream into the engaged time, so the ratio always reconciles with presence', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 40, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...sessionRun({ from: 0, to: 40, cwd: FUT }),
        ...focusRun({ from: 20, to: 25, appId: 'slack' }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(day.engagedMs).toBe(day.streams.reduce((sum, stream) => sum + stream.engagedMs, 0));
    expect(day.concurrency).toBe(day.engagedMs / day.presenceMs);
    expect(day.engagedMs).toBeGreaterThanOrEqual(day.presenceMs);
  });
});
