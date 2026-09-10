import { describe, expect, it } from 'vitest';
import { CollectedEvent, TokenUsage } from '../model/event';
import { TimetrackProjectLink } from '../model/project-link';
import { OTHER_APPLICATIONS_KEY, streamDay } from './stream-day';
import { unnamedFocusMs } from './unnamed-focus';

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

const heartbeat = (options: {
  minutes: number;
  repoPath?: string;
  directory?: string;
  branch?: string;
  editing?: boolean;
}): CollectedEvent => ({
  at: AT(options.minutes),
  source: 'editor',
  kind: 'editor-heartbeat',
  reporter: 'vscode',
  repoPath: options.repoPath,
  branch: options.branch ?? 'next',
  directory: options.directory,
  editing: options.editing ?? true,
});

const heartbeatRun = (options: { from: number; to: number; repoPath?: string; directory?: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) =>
    heartbeat({ ...options, minutes: options.from + offset }),
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

  it('names the application when the window source reports no title', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'com.google.Chrome', title: '' }),
        ...focusRun({ from: 10, to: 20, appId: 'com.tinyspeck.slackmacgap', title: '' }),
      ],
    });

    const folded = streamOf(day, OTHER_APPLICATIONS_KEY);

    expect(folded?.evidence.map((entry) => entry.detail)).toEqual(['com.google.Chrome', 'com.tinyspeck.slackmacgap']);
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

  it('reads the stretch an agent worked through while the user was away as a break as well', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 60, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        presence(61, 'lock'),
        ...sessionRun({ from: 65, to: 115, cwd: SDK }),
        ...focusRun({ from: 120, to: 180, appId: 'code', title: 'ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.breaks).toEqual([{ from: AT(61), to: AT(120), locked: true }]);
    expect(day.unattendedMs).toBe(50 * MINUTE);
  });

  it('keeps the break whole when the agent kept changing the title of the window the user left', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 60, appId: 'code', title: 'presence.ts - ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        presence(61, 'idle-start'),
        ...sessionRun({ from: 65, to: 115, cwd: SDK }),
        focus(90, 'code', 'breaks.ts - ethlete-sdk - Code'),
        focus(95, 'code', 'stream-day.ts - ethlete-sdk - Code'),
        presence(120, 'idle-end'),
        ...focusRun({ from: 120, to: 180, appId: 'code', title: 'lanes.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.breaks).toEqual([{ from: AT(61), to: AT(120), locked: false }]);
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
      focusMs: 0,
      unnamedFocus: [],
      namedApps: [],
      concurrency: 0,
      unattendedMs: 0,
      breaks: [],
      breakMs: 0,
      rebuiltMs: 0,
      streams: [],
      blocks: [],
      rows: {
        proposals: [],
        unattributed: [],
        unnamed: [],
        meetings: [],
        calls: [],
        timers: [],
        filledMs: 0,
        private: [],
        privateMs: 0,
      },
      spend: { usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 }, turns: 0, models: [] },
      unattributedSpend: {
        usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, thinking: 0 },
        turns: 0,
        models: [],
      },
      ambiguousNames: [],
      calls: [],
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

describe('streamDay, on a day an editor reported', () => {
  it('names the checkout a window title reading only the application cannot', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 30, appId: 'code', title: 'Visual Studio Code' }),
        ...heartbeatRun({ from: 0, to: 30, repoPath: FUT, directory: 'src/app' }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${FUT}`]);
    expect(streamOf(day, `repo:${FUT}`)?.engagedMs).toBe(30 * MINUTE);
    expect(streamOf(day, `repo:${FUT}`)?.branches).toEqual(['next']);
  });

  it('adds no presence of its own, so the ratio still reconciles', () => {
    const withEditor = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'Visual Studio Code' }),
        ...heartbeatRun({ from: 0, to: 40, repoPath: FUT }),
      ],
      options: { repoRoots: [FUT] },
    });
    const withoutEditor = streamDay({
      events: focusRun({ from: 0, to: 10, appId: 'code', title: 'Visual Studio Code' }),
      options: { repoRoots: [FUT] },
    });

    expect(withEditor.presenceMs).toBe(withoutEditor.presenceMs);
    expect(withEditor.rebuiltMs).toBe(0);
    expect(withEditor.engagedMs).toBe(withEditor.presenceMs);
    expect(withEditor.concurrency).toBe(1);
  });

  it('keeps the checkout while the editor holds focus, and drops it at the next application', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'Visual Studio Code' }),
        ...heartbeatRun({ from: 0, to: 20, repoPath: FUT }),
        ...focusRun({ from: 20, to: 40, appId: 'slack' }),
      ],
      options: { repoRoots: [FUT] },
    });

    expect(streamOf(day, `repo:${FUT}`)?.engagedMs).toBe(20 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(20 * MINUTE);
  });

  it('holds the checkout no longer than the stickiness once the heartbeats stop', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'Visual Studio Code' }),
        heartbeat({ minutes: 0, repoPath: FUT }),
      ],
      options: { repoRoots: [FUT], repoStickinessMs: 5 * MINUTE },
    });

    expect(streamOf(day, `repo:${FUT}`)?.engagedMs).toBe(6 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(14 * MINUTE);
  });

  it('says what was read and what was edited, and names the directory rather than the file', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'Visual Studio Code' }),
        heartbeat({ minutes: 2, repoPath: FUT, directory: 'src/app/today', editing: false }),
        heartbeat({ minutes: 4, repoPath: FUT, directory: 'src/app/today', editing: true }),
      ],
      options: { repoRoots: [FUT] },
    });

    expect(streamOf(day, `repo:${FUT}`)?.evidence.filter((entry) => entry.kind === 'editor')).toEqual([
      { kind: 'editor', at: AT(2), detail: 'read src/app/today' },
      { kind: 'editor', at: AT(4), detail: 'edited src/app/today' },
    ]);
  });

  it('drops a heartbeat from a private checkout, name and directory alike', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'Visual Studio Code' }),
        ...heartbeatRun({ from: 0, to: 20, repoPath: ELROND, directory: 'src/secret' }),
      ],
      options: { repoRoots: [ELROND], links: [privateLink(ELROND)] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([OTHER_APPLICATIONS_KEY]);
    expect(JSON.stringify(day)).not.toContain('elrond');
    expect(JSON.stringify(day)).not.toContain('secret');
  });

  it('names no stream for a heartbeat that found no checkout', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'Visual Studio Code' }),
        heartbeat({ minutes: 2, directory: '/home/tom/Downloads/scratch' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([OTHER_APPLICATIONS_KEY]);
    expect(JSON.stringify(day)).not.toContain('Downloads');
  });

  it('lets a window title that names a checkout outrank the editor', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...heartbeatRun({ from: 0, to: 20, repoPath: FUT }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(20 * MINUTE);
    expect(streamOf(day, `repo:${FUT}`)).toBeUndefined();
  });
});

describe('streamDay, on a day the collector never ran', () => {
  it('rebuilds the day from the prompts the user typed, and says how much of it that is', () => {
    const day = streamDay({ events: [typed(0, SDK), typed(10, SDK), typed(20, SDK)], options: { repoRoots: [SDK] } });

    expect(day.presenceMs).toBe(20 * MINUTE);
    expect(day.rebuiltMs).toBe(20 * MINUTE);
    expect(day.streams).toHaveLength(1);
    expect(day.streams[0]?.key).toBe(`repo:${SDK}`);
    expect(day.streams[0]?.engagedMs).toBe(20 * MINUTE);
    expect(day.streams[0]?.rebuiltMs).toBe(20 * MINUTE);
  });

  it('carries the checkout the prompts were typed in, not the other-applications line', () => {
    const day = streamDay({
      events: [typed(0, `${FUT}/apps/web`), typed(10, `${FUT}/apps/web`)],
      options: { repoRoots: [FUT] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([`repo:${FUT}`]);
    expect(day.streams[0]?.neverFocused).toBe(true);
    expect(day.streams[0]?.evidence.map((entry) => entry.kind)).toEqual(['prompt']);
  });

  it('holds the day open across the minutes an agent worked between two prompts', () => {
    const day = streamDay({
      events: [typed(0, SDK), usage(10, SDK), usage(20, SDK), typed(25, SDK)],
      options: { repoRoots: [SDK] },
    });

    expect(day.presenceMs).toBe(25 * MINUTE);
    expect(day.streams[0]?.engagedMs).toBe(25 * MINUTE);
  });

  it('books nothing for a day of turns the user typed nothing in', () => {
    const day = streamDay({ events: [usage(0, SDK), usage(10, SDK), usage(20, SDK)], options: { repoRoots: [SDK] } });

    expect(day.presenceMs).toBe(0);
    expect(day.rebuiltMs).toBe(0);
    expect(day.streams[0]?.engagedMs).toBe(0);
  });

  it('splits the streams by the checkout each prompt names', () => {
    const day = streamDay({
      events: [typed(0, SDK), typed(10, FUT), typed(20, FUT)],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(day.streams.map((stream) => [stream.key, stream.engagedMs])).toEqual([
      [`repo:${SDK}`, 10 * MINUTE],
      [`repo:${FUT}`, 10 * MINUTE],
    ]);
    expect(day.engagedMs).toBe(day.presenceMs);
  });

  it('gives the folded line the minutes of a prompt typed where no checkout is, and names the directory nowhere', () => {
    const day = streamDay({
      events: [typed(0, '/home/tom/Downloads/ImageGeneratorProd'), typed(10, '/home/tom/Downloads/ImageGeneratorProd')],
      options: { repoRoots: [SDK] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([OTHER_APPLICATIONS_KEY]);
    expect(day.presenceMs).toBe(10 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(10 * MINUTE);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.evidence.map((entry) => entry.kind)).toEqual(['prompt']);
  });

  it('gives the folded line the turns spent in a directory that is no checkout', () => {
    const day = streamDay({
      events: [typed(0, '/home/tom'), usage(5, '/home/tom', { output: 900 }), typed(10, '/home/tom')],
      options: { repoRoots: [SDK] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([OTHER_APPLICATIONS_KEY]);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.spend.turns).toBe(1);
    expect(day.unattributedSpend.turns).toBe(0);
  });

  it('names no stream after the directory a private checkout sits in', () => {
    const day = streamDay({
      events: [typed(0, ELROND), typed(10, ELROND)],
      options: { repoRoots: [SDK, `${ELROND}/elrond`], links: [privateLink(`${ELROND}/elrond`)] },
    });

    expect(day.streams.map((stream) => stream.key)).toEqual([OTHER_APPLICATIONS_KEY]);
    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.repoPath).toBeUndefined();
  });

  it('drops a prompt typed in a private checkout', () => {
    const day = streamDay({
      events: [typed(0, ELROND), typed(10, ELROND)],
      options: { repoRoots: [ELROND], links: [privateLink(ELROND)] },
    });

    expect(day.streams).toEqual([]);
    expect(day.presenceMs).toBe(0);
  });

  it('reconciles a day that was watched in the morning and rebuilt in the afternoon', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 40, appId: 'code', title: 'ethlete-sdk - Code' }),
        ...focusRun({ from: 40, to: 50, appId: 'slack' }),
        typed(70, SDK),
        typed(80, SDK),
        typed(90, SDK),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.presenceMs).toBe(70 * MINUTE);
    expect(day.rebuiltMs).toBe(20 * MINUTE);
    expect(day.engagedMs).toBe(70 * MINUTE);
    expect(day.streams.find((stream) => stream.key === `repo:${SDK}`)?.rebuiltMs).toBe(20 * MINUTE);
    expect(day.streams.find((stream) => stream.key === OTHER_APPLICATIONS_KEY)?.rebuiltMs).toBe(0);
  });

  it('reports nothing rebuilt for a day its windows observed', () => {
    const day = streamDay({
      events: [...focusRun({ from: 0, to: 40, appId: 'code', title: 'ethlete-sdk - Code' }), typed(20, SDK)],
      options: { repoRoots: [SDK] },
    });

    expect(day.presenceMs).toBe(40 * MINUTE);
    expect(day.rebuiltMs).toBe(0);
  });
});

describe('streamDay, on the app reading the day', () => {
  it('keeps the minutes its own window held, and names neither the application nor the observation', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'timetrack', title: 'Timetrack' }),
        ...focusRun({ from: 10, to: 20, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK], ownAppIds: ['timetrack'] },
    });
    const folded = streamOf(day, OTHER_APPLICATIONS_KEY);

    expect(day.presenceMs).toBe(20 * MINUTE);
    expect(folded?.engagedMs).toBe(10 * MINUTE);
    expect(folded?.apps).toEqual([]);
    expect(folded?.evidence).toEqual([]);
  });

  it('draws no band for its own window, so a review never asks which ticket it books to', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'timetrack', title: 'Timetrack' }),
        ...focusRun({ from: 10, to: 20, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK], ownAppIds: ['timetrack'] },
    });

    expect(day.rows.unnamed.map((row) => row.laneKey)).toEqual([`repo:${SDK}`]);
    expect(day.presenceMs).toBe(20 * MINUTE);
  });

  it('matches an application id whatever its case', () => {
    const day = streamDay({
      events: focusRun({ from: 0, to: 10, appId: 'io.ethlete.Timetrack', title: 'Timetrack' }),
      options: { ownAppIds: ['io.ethlete.timetrack'] },
    });

    expect(streamOf(day, OTHER_APPLICATIONS_KEY)?.apps).toEqual([]);
  });

  it('does not book its own window to a checkout its title happens to name', () => {
    const events = [
      commit(0, 'feat(timetrack): Add the day', '/home/tom/dev/timetrack'),
      ...focusRun({ from: 1, to: 10, appId: 'timetrack', title: 'timetrack' }),
    ];
    const repoRoots = ['/home/tom/dev/timetrack'];
    const own = streamDay({ events, options: { repoRoots, ownAppIds: ['timetrack'] } });
    const named = streamDay({ events, options: { repoRoots } });

    expect(streamOf(named, 'repo:/home/tom/dev/timetrack')?.neverFocused).toBe(false);
    expect(streamOf(own, 'repo:/home/tom/dev/timetrack')?.neverFocused).toBe(true);
    expect(streamOf(own, OTHER_APPLICATIONS_KEY)?.engagedMs).toBe(9 * MINUTE);
  });
});

describe('streamDay, on a stream with more observations than the list holds', () => {
  it('keeps the first 500 and counts the rest', () => {
    const day = streamDay({
      events: Array.from({ length: 600 }, (_, index) => focus(index, 'google-chrome', `page ${index}`)),
      options: {},
    });
    const folded = streamOf(day, OTHER_APPLICATIONS_KEY);

    expect(folded?.evidence).toHaveLength(500);
    expect(folded?.evidenceOmitted).toBe(100);
    expect(folded?.evidence[0]?.detail).toBe('page 0');
  });

  it('counts a repeated title once, so a cap is never reached by repetition', () => {
    const day = streamDay({
      events: focusRun({ from: 0, to: 600, appId: 'google-chrome', title: 'Inbox' }),
      options: {},
    });
    const folded = streamOf(day, OTHER_APPLICATIONS_KEY);

    expect(folded?.evidence).toHaveLength(1);
    expect(folded?.evidenceOmitted).toBe(0);
  });
});

describe('streamDay, on a day still being collected', () => {
  const morning = [
    ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
    typed(11, SDK),
    usage(12, SDK),
    usage(13, SDK),
  ];

  it('reports the minutes after the last focus change as rebuilt, when nothing says the source is fresh', () => {
    const day = streamDay({ events: morning, options: { repoRoots: [SDK] } });

    expect(day.rebuiltMs).toBe(MINUTE);
  });

  it('holds the focused window where it was left, through what the source reported', () => {
    const day = streamDay({
      events: morning,
      options: { repoRoots: [SDK], windowsSeenThroughMs: AT(13).getTime() },
    });

    expect(day.rebuiltMs).toBe(0);
    expect(day.presenceMs).toBe(13 * MINUTE);
    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(13 * MINUTE);
  });

  it('holds nothing open across a gap wider than the safety valve', () => {
    const day = streamDay({
      events: focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      options: { repoRoots: [SDK], windowsSeenThroughMs: AT(90).getTime() },
    });

    expect(day.presenceMs).toBe(10 * MINUTE);
  });

  it('holds nothing open once the machine reported the user away', () => {
    const day = streamDay({
      events: [...focusRun({ from: 0, to: 10, appId: 'code' }), presence(11, 'idle-start')],
      options: { windowsSeenThroughMs: AT(13).getTime() },
    });

    expect(day.presenceMs).toBe(11 * MINUTE);
  });
});

describe('streamDay, on a day something held the microphone', () => {
  const DISCORD = 'com.hnc.Discord';
  const HELPER = 'com.hnc.Discord.helper.Renderer';

  const call = (minutes: number, kind: 'call-start' | 'call-end', appId = HELPER): CollectedEvent => ({
    at: AT(minutes),
    source: 'call',
    kind,
    appId,
  });

  const meeting = [focus(0, DISCORD, '#standup | Braune Digital'), call(2, 'call-start'), call(50, 'call-end')];

  it('reports every call, whether or not a rule made it work', () => {
    const day = streamDay({ events: meeting });

    expect(day.calls).toHaveLength(1);
    expect(day.calls[0]!.title).toBe('#standup | Braune Digital');
    expect(day.calls[0]!.countsAsWork).toBe(false);
  });

  it('adds no presence for a call nothing classified', () => {
    const day = streamDay({ events: meeting });

    expect(day.presenceMs).toBe(0);
  });

  it('counts a working call as presence for its whole stretch', () => {
    const day = streamDay({
      events: meeting,
      options: { callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] } },
    });

    expect(day.presenceMs).toBe(48 * MINUTE);
  });

  it('reports a working call as watched rather than as rebuilt', () => {
    const day = streamDay({
      events: meeting,
      options: { callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] } },
    });

    expect(day.rebuiltMs).toBe(0);
  });

  it('books the call to no checkout, so the hour reads as presence nothing engaged', () => {
    const day = streamDay({
      events: meeting,
      options: { callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] } },
    });

    expect(day.engagedMs).toBe(0);
    expect(day.concurrency).toBe(0);
  });

  it('never lets a call set the checkout the following minutes are booked to', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 4, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        focus(5, DISCORD, '#standup | Braune Digital'),
        call(6, 'call-start'),
        call(40, 'call-end'),
      ],
      options: {
        repoRoots: [SDK],
        callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
      },
    });

    expect(streamOf(day, `repo:${SDK}`)?.engagedMs).toBe(5 * MINUTE);
  });

  it('runs a call nobody has hung up through what the sources reported', () => {
    const day = streamDay({
      events: [focus(0, DISCORD, '#standup | Braune Digital'), call(2, 'call-start')],
      options: {
        windowsSeenThroughMs: AT(60).getTime(),
        callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
      },
    });

    expect(day.calls[0]!.to).toEqual(AT(60));
    expect(day.presenceMs).toBe(58 * MINUTE);
  });

  it('counts a call the user was silent through, which nothing else observed at all', () => {
    const day = streamDay({
      events: [
        focus(0, DISCORD, '#standup | Braune Digital'),
        presence(1, 'idle-start'),
        call(2, 'call-start'),
        call(50, 'call-end'),
      ],
      options: { callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] } },
    });

    expect(day.presenceMs).toBe(49 * MINUTE);
  });
});

describe('streamDay, the focus that named no checkout', () => {
  it('reports the time per application, longest first', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 5, appId: 'firefox', title: 'localhost:4200 \u2014 Mozilla Firefox' }),
        ...focusRun({ from: 6, to: 20, appId: 'foot', title: 'tom@fedora: ~' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unnamedFocus).toEqual([
      { appId: 'foot', reason: 'no-name', ms: 14 * MINUTE, titles: [{ title: 'tom@fedora: ~', ms: 14 * MINUTE }] },
      {
        appId: 'firefox',
        reason: 'no-name',
        ms: 6 * MINUTE,
        titles: [{ title: 'localhost:4200 \u2014 Mozilla Firefox', ms: 6 * MINUTE }],
      },
    ]);
  });

  it('names the distinct titles behind one application, longest first', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 5, appId: 'firefox', title: 'Mail \u2014 Mozilla Firefox' }),
        ...focusRun({ from: 6, to: 20, appId: 'firefox', title: 'localhost:4200 \u2014 Mozilla Firefox' }),
        ...focusRun({ from: 21, to: 24, appId: 'firefox', title: 'Mail \u2014 Mozilla Firefox' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unnamedFocus[0]?.titles).toEqual([
      { title: 'localhost:4200 \u2014 Mozilla Firefox', ms: 15 * MINUTE },
      { title: 'Mail \u2014 Mozilla Firefox', ms: 9 * MINUTE },
    ]);
  });

  it('sums the titles of a row to the row, so an open row reconciles with the line above it', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'firefox', title: 'Mail \u2014 Mozilla Firefox' }),
        ...focusRun({ from: 11, to: 20, appId: 'firefox', title: 'localhost:4200 \u2014 Mozilla Firefox' }),
      ],
      options: { repoRoots: [SDK] },
    });
    const row = day.unnamedFocus[0];

    expect(row?.titles.reduce((sum, held) => sum + held.ms, 0)).toBe(row?.ms);
  });

  it('keeps the title of a window a checkout took out of the row, because that time is not folded', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 20, appId: 'discord', title: 'Discord' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unnamedFocus).toEqual([
      { appId: 'discord', reason: 'no-name', ms: 9 * MINUTE, titles: [{ title: 'Discord', ms: 9 * MINUTE }] },
    ]);
  });

  it('sums to the focused-window time of the folded line, so the panel reconciles with the screen', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 30, appId: 'firefox', title: 'localhost:4200 \u2014 Mozilla Firefox' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(unnamedFocusMs(day.unnamedFocus)).toBe(streamOf(day, OTHER_APPLICATIONS_KEY)?.engagedMs);
    expect(unnamedFocusMs(day.unnamedFocus) + (streamOf(day, `repo:${SDK}`)?.engagedMs ?? 0)).toBe(day.focusMs);
  });

  it('reports nothing for a window a checkout took', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unnamedFocus).toEqual([]);
    expect(day.focusMs).toBe(20 * MINUTE);
  });

  it('reports nothing for a window the sticky named, because that time is not folded either', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 13, appId: 'code', title: 'Visual Studio Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.unnamedFocus).toEqual([]);
  });

  it('marks a private checkout as correctly unnamed, apart from the defect', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 11, to: 20, appId: 'code', title: 'plan.md - umbau-elrond - Code' }),
      ],
      options: { repoRoots: [SDK, ELROND], links: [privateLink(ELROND)] },
    });

    expect(day.unnamedFocus).toEqual([{ appId: 'code', reason: 'private', ms: 9 * MINUTE, titles: [] }]);
    expect(JSON.stringify(day.unnamedFocus)).not.toContain('elrond');
  });

  it('marks the time this app was in front as its own, although no line names it', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 20, appId: 'timetrack', title: 'Timetrack' }),
      ],
      options: { repoRoots: [SDK], ownAppIds: ['timetrack'] },
    });

    expect(day.unnamedFocus).toEqual([
      { appId: 'timetrack', reason: 'own-window', ms: 9 * MINUTE, titles: [{ title: 'Timetrack', ms: 9 * MINUTE }] },
    ]);
  });

  it('marks a name two checkouts share apart from a title that names nothing', () => {
    const OTHER_ELROND = '/home/tom/elrond-usb/stick-bios/doku/elrond';

    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'boot.md - elrond - Code' }),
        ...focusRun({ from: 11, to: 20, appId: 'spotify', title: 'Spotify' }),
      ],
      options: { repoRoots: ['/home/tom/umbau-elrond/elrond', OTHER_ELROND] },
    });

    expect(day.unnamedFocus).toEqual([
      {
        appId: 'code',
        reason: 'ambiguous-name',
        ms: 11 * MINUTE,
        titles: [{ title: 'boot.md - elrond - Code', ms: 11 * MINUTE }],
      },
      { appId: 'spotify', reason: 'no-name', ms: 9 * MINUTE, titles: [{ title: 'Spotify', ms: 9 * MINUTE }] },
    ]);
  });

  it('keeps the two causes of one application apart', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 5, appId: 'code', title: 'ethlete-sdk - Code' }),
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 6, to: 12, appId: 'code', title: 'plan.md - umbau-elrond - Code' }),
        ...focusRun({ from: 13, to: 25, appId: 'code', title: 'Visual Studio Code' }),
      ],
      options: { repoRoots: [SDK, ELROND], links: [privateLink(ELROND)] },
    });

    expect(day.unnamedFocus).toEqual([
      {
        appId: 'code',
        reason: 'no-name',
        ms: 12 * MINUTE,
        titles: [{ title: 'Visual Studio Code', ms: 12 * MINUTE }],
      },
      { appId: 'code', reason: 'private', ms: 7 * MINUTE, titles: [] },
    ]);
  });

  it('counts none of a stretch nothing watched, so a rebuilt day reports no unnamed focus', () => {
    const day = streamDay({
      events: [typed(0, SDK), typed(20, SDK), usage(10, SDK, { output: 400 })],
      options: { repoRoots: [SDK] },
    });

    expect(day.rebuiltMs).toBe(20 * MINUTE);
    expect(day.unnamedFocus).toEqual([]);
    expect(day.focusMs).toBe(0);
  });

  it('gives an application the user declared no work context its own cause', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 25, appId: 'Spotify', title: 'Spotify' }),
      ],
      options: { repoRoots: [SDK], noWorkContextApps: ['spotify'] },
    });

    expect(day.unnamedFocus).toEqual([
      { appId: 'Spotify', reason: 'no-work-context', ms: 14 * MINUTE, titles: [{ title: 'Spotify', ms: 14 * MINUTE }] },
    ]);
  });

  it('gives a transient dialog its own cause', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 13, appId: 'xdg-desktop-portal-gnome', title: 'Open File' }),
      ],
      options: { repoRoots: [SDK], transientApps: ['xdg-desktop-portal-gnome'] },
    });

    expect(day.unnamedFocus.map((row) => row.reason)).toEqual(['transient']);
  });

  it('still lets a declared application name a checkout its title holds', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'firefox', title: 'ethlete-sdk - Mozilla Firefox' }),
      ],
      options: { repoRoots: [SDK], noWorkContextApps: ['firefox'] },
    });

    expect(day.unnamedFocus).toEqual([]);
    expect(day.namedApps).toEqual(['firefox']);
  });

  it('names the application whose window held a checkout, and only that one', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 10, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 11, to: 20, appId: 'discord', title: 'Discord' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.namedApps).toEqual(['code']);
  });

  it('names an application the sticky held the checkout for, because the window was still its own', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 5, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 5, to: 10, appId: 'code', title: 'Visual Studio Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(day.namedApps).toEqual(['code']);
    expect(day.unnamedFocus).toEqual([]);
  });

  it('names no application on a day no window held a checkout', () => {
    const day = streamDay({
      events: focusRun({ from: 0, to: 20, appId: 'discord', title: 'Discord' }),
      options: { repoRoots: [SDK] },
    });

    expect(day.namedApps).toEqual([]);
  });
});

describe('streamDay, the blocks a row is built from', () => {
  const blocksIn = (day: ReturnType<typeof streamDay>, repoPath: string) =>
    day.blocks.filter((block) => block.context.repoPath === repoPath);

  const spanMs = (blocks: readonly { from: Date; to: Date }[]) =>
    blocks.reduce((sum, block) => sum + (block.to.getTime() - block.from.getTime()), 0);

  it('gives one checkout one block, carrying what was observed in it', () => {
    const day = streamDay({
      events: [
        commit(0, 'feat(bracket): Add the resolver'),
        ...focusRun({ from: 0, to: 30, appId: 'code', title: 'block.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    const blocks = blocksIn(day, SDK);

    expect(blocks).toHaveLength(1);
    expect(spanMs(blocks)).toBe(30 * MINUTE);
    expect(blocks[0]?.context.branch).toBe('next');
    expect(blocks[0]?.evidence.map((entry) => entry.kind)).toContain('commit');
  });

  it('sums a checkout its stream engaged time', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 20, appId: 'code', title: 'a.ts - ethlete-sdk - Code' }),
        ...focusRun({ from: 20, to: 30, appId: 'slack' }),
        ...focusRun({ from: 30, to: 50, appId: 'code', title: 'b.ts - ethlete-sdk - Code' }),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(spanMs(blocksIn(day, SDK))).toBe(streamOf(day, `repo:${SDK}`)?.engagedMs);
  });

  it('splits a block where the branch changed, and leaves the stream whole', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 40, appId: 'code', title: 'a.ts - ethlete-sdk - Code' }),
        checkout(20, 'feat/EM-1'),
      ],
      options: { repoRoots: [SDK] },
    });

    expect(blocksIn(day, SDK).map((block) => block.context.branch)).toEqual([undefined, 'feat/EM-1']);
    expect(day.streams).toHaveLength(1);
  });

  it('lets two contexts hold the same minute, and no context overlap itself', () => {
    const day = streamDay({
      events: [
        ...focusRun({ from: 0, to: 40, appId: 'code', title: 'a.ts - ethlete-sdk - Code' }),
        ...sessionRun({ from: 10, to: 30, cwd: FUT }),
      ],
      options: { repoRoots: [SDK, FUT] },
    });

    expect(spanMs(blocksIn(day, SDK))).toBe(40 * MINUTE);
    expect(spanMs(blocksIn(day, FUT))).toBe(20 * MINUTE);
    expect(blocksIn(day, FUT)).toHaveLength(1);
  });
});
