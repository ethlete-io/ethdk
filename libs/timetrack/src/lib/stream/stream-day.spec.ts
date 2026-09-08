import { describe, expect, it } from 'vitest';
import { CollectedEvent, TokenUsage } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { OTHER_APPLICATIONS_KEY, streamDay } from './stream-day';

const SDK = '/home/tom/dev/ethlete-sdk';
const FUT = '/home/tom/dev/fut-frontend';
const ELROND = '/home/tom/umbau-elrond';

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

const typed = (minutes: number, cwd: string): CollectedEvent => ({
  at: AT(minutes),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: 'session-1',
  promptId: `prompt-${minutes}`,
  cwd,
  gitBranch: 'next',
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

const privateLink = (path: string): TimetrackProjectLink => ({
  id: path,
  path,
  target: { kind: 'private' },
  createdAt: new Date(2026, 0, 1),
});

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
    expect(streamOf(day, `repo:${SDK}`)?.agentSessions).toBe(0);
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
    expect(stream?.agentSessions).toBe(5);
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

  it('holds the checkout a title named for a title that names none, until the stickiness runs out', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 5, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 6, to: 30, appId: 'code', title: 'Visual Studio Code' }),
      ],
      options: { repoRoots: [SDK], repoStickinessMs: 5 * MINUTE },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(11 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(19 * MINUTE);
  });

  it('never lets a commit hold the focused window, so browsing after one stays off the checkout', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 30, appId: 'firefox', title: 'Home · GitLab — Firefox' }),
      ],
      options: { repoRoots: [SDK], repoStickinessMs: 5 * MINUTE },
    });

    expect(streamOf(day, `repo:${SDK}`)).toBeUndefined();
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(30 * MINUTE);
  });

  it('never passes the sticky to another application, so a browser page stays off the checkout', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 5, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 6, to: 10, appId: 'chrome', title: 'Generate legacy token · User Settings · GitLab' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.evidence.map((entry) => entry.detail)).toEqual([
      'block.ts - ethlete-sdk - Code',
    ]);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.evidence.map((entry) => entry.detail)).toEqual([
      'Generate legacy token · User Settings · GitLab',
    ]);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(4 * MINUTE);
  });

  it('passes the sticky inside one application, so an editor title that names nothing keeps its checkout', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 5, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 6, to: 10, appId: 'code', title: 'Visual Studio Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(10 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)).toBeUndefined();
  });

  it('names a checkout by a discovered root the day holds no event for', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'notes.md - specs - Code' }),
        ...focusRun({ from: 11, to: 20, appId: 'code', title: 'bracket.spec.ts - fut-frontend - Code' }),
      ],
      options: { repoRoots: ['/home/tom/dev/specs', FUT] },
    });

    expect(streamOf(day, 'repo:/home/tom/dev/specs')?.engagedMs).toBe(11 * MINUTE);
    expect(streamOf(day, `repo:${FUT}`)?.engagedMs).toBe(9 * MINUTE);
  });

  it('books a turn to its checkout by the working directory alone, whatever the clock said', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        usage(5, SDK, { output: 400 }),
        usage(300, SDK, { output: 700 }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.spend.usage.output).toBe(1_100);
    expect(streamOf(day, `repo:${SDK}`)?.spend.turns).toBe(2);
    expect(day.unattributedSpend.turns).toBe(0);
    expect(day.spend.usage.output).toBe(1_100);
    expect(day.spend.models).toEqual(['claude-opus-5']);
  });

  it('gives a checkout with turns and no samples a line of its own, carrying spend and no time', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        usage(4, FUT, { output: 900 }),
        usage(9, FUT, { output: 100 }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    const fut = streamOf(day, `repo:${FUT}`);

    expect(fut?.spend.usage.output).toBe(1_000);
    expect(fut?.engagedMs).toBe(0);
    expect(fut?.unattendedMs).toBe(0);
    expect(fut?.neverFocused).toBe(true);
    expect(fut?.from).toEqual(AT(4));
    expect(fut?.to).toEqual(AT(9));
    expect(day.engagedMs).toBe(10 * MINUTE);
    expect(day.unattributedSpend.turns).toBe(0);
  });

  it('reports a turn that names no working directory as unattributed, because nothing can carry it', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        usage(5, '', { output: 700 }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unattributedSpend.usage.output).toBe(700);
    expect(day.spend.usage.output).toBe(700);
    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${SDK}`]);
  });

  it('books an agent turn spent while the user was away to its checkout, and calls the time unattended', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        presence(11, 'lock'),
        ...sessionRun({ from: 20, to: 50, cwd: FUT }),
        usage(35, FUT, { output: 900 }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    const fut = streamOf(day, `repo:${FUT}`);

    expect(fut?.spend.usage.output).toBe(900);
    expect(fut?.engagedMs).toBe(0);
    expect(fut?.unattendedMs).toBe(30 * MINUTE);
    expect(fut?.from).toEqual(AT(20));
    expect(fut?.to).toEqual(AT(50));
    expect(day.unattendedMs).toBe(30 * MINUTE);
    expect(day.engagedMs).toBe(11 * MINUTE);
    expect(day.presenceMs).toBe(11 * MINUTE);
    expect(day.unattributedSpend.turns).toBe(0);
  });

  it('splits one agent run into the attended part and the unattended part, and counts each minute once', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...sessionRun({ from: 10, to: 40, cwd: FUT }),
        presence(20, 'lock'),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    const fut = streamOf(day, `repo:${FUT}`);

    expect(fut?.engagedMs).toBe(10 * MINUTE);
    expect(fut?.unattendedMs).toBe(20 * MINUTE);
    expect(fut?.from).toEqual(AT(10));
    expect(fut?.to).toEqual(AT(40));
  });

  it('takes a checkout a private link covers out of the day, line, evidence and spend alike', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 11, to: 20, appId: 'code', title: 'plan.md - umbau-elrond - Code' }),
        commit(12, 'chore: Tile the bathroom', ELROND),
        ...sessionRun({ from: 12, to: 20, cwd: ELROND }),
        usage(15, ELROND, { output: 900 }),
      ],
      options: { repoRoots: [SDK, ELROND], links: [privateLink(ELROND)] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${SDK}`, OTHER_APPLICATIONS_KEY]);
    expect(day.spend.turns).toBe(0);
    expect(JSON.stringify(day)).not.toContain('elrond');
    expect(JSON.stringify(day)).not.toContain('bathroom');
  });

  it('folds a private window into the other line rather than onto the last checkout the sticky held', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 11, to: 20, appId: 'code', title: 'plan.md - umbau-elrond - Code' }),
      ],
      options: { repoRoots: [SDK, ELROND], links: [privateLink(ELROND)] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(11 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(9 * MINUTE);
    expect(day.presenceMs).toBe(20 * MINUTE);
  });

  it('names the checkout name it dropped, so the folded time on the screen has a reason', () => {
    const OTHER_ELROND = '/home/tom/elrond-usb/stick-bios/doku/elrond';

    const day = streamDay({
      events: focusRun({ from: 0, to: 10, appId: 'code', title: 'boot.md - elrond - Code' }),
      options: { repoRoots: ['/home/tom/umbau-elrond/elrond', OTHER_ELROND] },
    });

    expect(day.ambiguousNames).toEqual(['elrond']);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(10 * MINUTE);
  });

  it('names nothing for a day whose windows never claimed a shared name', () => {
    const day = streamDay({
      events: focusRun({ from: 0, to: 10, appId: 'slack' }),
      options: { repoRoots: ['/home/tom/umbau-elrond/elrond', '/home/tom/elrond-usb/stick-bios/doku/elrond'] },
    });

    expect(day.ambiguousNames).toEqual([]);
  });

  it('reads nothing from a day nothing observed', () => {
    const day = streamDay({ events: [] });

    expect(day).toEqual({
      presenceMs: 0,
      engagedMs: 0,
      concurrency: 0,
      unattendedMs: 0,
      reconstructedMs: 0,
      streams: [],
      spend: { usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 }, turns: 0, models: [] },
      unattributedSpend: {
        usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 },
        turns: 0,
        models: [],
      },
      ambiguousNames: [],
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

describe('streamDay, on a day the collector never ran', () => {
  it('rebuilds the day from the prompts the user typed, and says how much of it that is', () => {
    const day = streamDay({ events: [typed(0, SDK), typed(10, SDK), typed(20, SDK)] });

    expect(day.presenceMs).toBe(20 * MINUTE);
    expect(day.reconstructedMs).toBe(20 * MINUTE);
    expect(day.streams).toHaveLength(1);
    expect(day.streams[0]?.key).toBe(`repo:${SDK}`);
    expect(day.streams[0]?.engagedMs).toBe(20 * MINUTE);
    expect(day.streams[0]?.reconstructedMs).toBe(20 * MINUTE);
  });

  it('carries the checkout the prompts were typed in, not the other-applications line', () => {
    const day = streamDay({ events: [typed(0, `${FUT}/apps/web`), typed(10, `${FUT}/apps/web`)] });

    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${FUT}/apps/web`]);
    expect(day.streams[0]?.neverFocused).toBe(true);
    expect(day.streams[0]?.evidence.map((entry) => entry.kind)).toEqual(['prompt']);
  });

  it('holds the day open across the minutes an agent worked between two prompts', () => {
    const day = streamDay({
      events: [typed(0, SDK), usage(10, SDK), usage(20, SDK), typed(25, SDK)],
    });

    expect(day.presenceMs).toBe(25 * MINUTE);
    expect(day.streams[0]?.engagedMs).toBe(25 * MINUTE);
  });

  it('books nothing for a day of turns the user typed nothing in', () => {
    const day = streamDay({ events: [usage(0, SDK), usage(10, SDK), usage(20, SDK)] });

    expect(day.presenceMs).toBe(0);
    expect(day.reconstructedMs).toBe(0);
    expect(day.streams[0]?.engagedMs).toBe(0);
  });

  it('splits the streams by the checkout each prompt names', () => {
    const day = streamDay({ events: [typed(0, SDK), typed(10, FUT), typed(20, FUT)] });

    expect(day.streams.map((stream) => [stream.key, stream.engagedMs])).toEqual([
      [`repo:${SDK}`, 10 * MINUTE],
      [`repo:${FUT}`, 10 * MINUTE],
    ]);
    expect(day.engagedMs).toBe(day.presenceMs);
  });

  it('drops a prompt typed in a private checkout', () => {
    const day = streamDay({
      events: [typed(0, ELROND), typed(10, ELROND)],
      options: { links: [privateLink(ELROND)] },
    });

    expect(day.streams).toEqual([]);
    expect(day.presenceMs).toBe(0);
  });

  it('reconciles a day that was watched in the morning and rebuilt in the afternoon', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 40, appId: 'code', title: 'ethlete-sdk - Code' }),
        typed(60, SDK),
        typed(70, SDK),
        typed(80, SDK),
      ],
    });

    expect(day.presenceMs).toBe(60 * MINUTE);
    expect(day.reconstructedMs).toBe(20 * MINUTE);
    expect(day.engagedMs).toBe(60 * MINUTE);
    expect(day.streams.find((stream) => stream.key === `repo:${SDK}`)?.reconstructedMs).toBe(20 * MINUTE);
    expect(day.streams.find((stream) => stream.key === OTHER_APPLICATIONS_KEY)?.reconstructedMs).toBe(0);
  });

  it('reports nothing rebuilt for a day its windows observed', () => {
    const day = streamDay({
      events: [...focusRun({ from: 0, to: 40, appId: 'code', title: 'ethlete-sdk - Code' }), typed(20, SDK)],
    });

    expect(day.presenceMs).toBe(40 * MINUTE);
    expect(day.reconstructedMs).toBe(0);
  });
});
