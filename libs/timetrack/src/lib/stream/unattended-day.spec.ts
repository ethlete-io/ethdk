import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimeWindow, clipWindows, windowsMs } from '../model/time-window';
import { ClosedTimerRun } from '../model/timer';
import { EMPTY_DAY_REVIEW_EDITS, PinnedRow, isNamedRow } from '../review/model';
import { TIMER_LANE_KEY } from '../rows/lane';
import { checkDay } from '../rows/round';
import { planTempoSync } from '../tempo/diff';
import { breakMs, breaksBetweenRows } from './breaks';
import { reviewDay } from '../review/review-day';
import { streamDay } from './stream-day';

const MINUTE = 60_000;
const DAY_START = new Date(2026, 8, 12, 0, 0, 0);
const AT = (minute: number) => new Date(DAY_START.getTime() + minute * MINUTE);
const REPO = '/home/tom/dev/ethlete-sdk';
const BRANCH = 'feat/ET-772-name-the-ticket';
const SESSION = 'session-1';
const CONFIG = resolveGitFlowConfig({ keyPrefixes: ['ET'] });

const focus = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'stream-day.ts - ethlete-sdk - Code',
});

const idle = (minute: number, kind: 'idle-start' | 'idle-end'): CollectedEvent => ({
  at: AT(minute),
  source: 'idle',
  kind,
});

const commit = (minute: number, subject: string): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-commit',
  repoPath: REPO,
  branch: BRANCH,
  sha: `sha-${minute}`,
  subject,
});

const session = (minute: number, sessionId = SESSION): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId,
  cwd: REPO,
  gitBranch: BRANCH,
});

const prompt = (minute: number, askedBy: 'human' | 'machine'): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: SESSION,
  promptId: `prompt-${minute}`,
  cwd: REPO,
  gitBranch: BRANCH,
  askedBy,
});

const turn = (minute: number, sessionId = SESSION): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId,
  turnId: `msg-${sessionId}-${minute}`,
  cwd: REPO,
  gitBranch: BRANCH,
  model: 'claude-opus-5',
  usage: { input: 3, output: 900, cacheWrite: 200, cacheRead: 60_000, thinking: 100 },
});

const dayOf = (events: CollectedEvent[]) =>
  streamDay({
    events: events.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
    options: {
      repoRoots: [REPO],
      windowsSeenThroughMs: AT(900).getTime(),
      rows: { config: CONFIG },
    },
  });

/**
 * The evening a person actually worked: an hour and a half at the keyboard, then they stop. No
 * `idle-start` follows, which is the real shape of 2026-09-12 — the machine suspended, and a
 * suspended machine reports no idleness.
 */
const EVENING: CollectedEvent[] = [
  focus(0),
  session(1),
  prompt(2, 'human'),
  turn(3),
  commit(60, 'feat(repo): Ask Jira what a picker is for'),
  focus(80),
  prompt(85, 'human'),
  turn(86),
  commit(88, 'test(repo): Read a band resting fill with the pointer off it'),
];

/**
 * An agent session that keeps working: a sample and a turn every ten minutes, which is inside the
 * fifteen-minute agent gap. This is what holds an `idle-start` bridged — the day cannot tell it from a
 * person who sat and watched.
 */
const running = (from: number, to: number, sessionId = SESSION): CollectedEvent[] =>
  Array.from({ length: Math.floor((to - from) / 10) + 1 }, (_, step) => [
    session(from + step * 10, sessionId),
    turn(from + step * 10, sessionId),
  ]).flat();

describe('streamDay, on an agent that ran while nobody was there', () => {
  /**
   * The failure this test exists for: a scheduled run kept working through the night, the idle-start
   * that began it was bridged by the agent's own turns, and the day read the whole night as a person
   * who worked it.
   */
  const NIGHT: CollectedEvent[] = [
    ...EVENING,
    idle(90, 'idle-start'),
    prompt(95, 'machine'),
    ...running(95, 475),
    commit(140, 'docs(repo): Complete the select option tables'),
    commit(240, 'chore(repo): Cut the cascader comments'),
    commit(340, 'fix(repo): Drop the href from a disabled nav tab link'),
    idle(480, 'idle-end'),
    focus(481),
  ];

  it('counts the night as unattended rather than as presence', () => {
    const day = dayOf(NIGHT);

    expect(day.presenceMs).toBeLessThan(120 * MINUTE);
    expect(day.unattendedMs).toBeGreaterThan(3 * 60 * MINUTE);
  });

  it('proposes no Tempo row for the night, though the branch names the issue', () => {
    const booked = dayOf(NIGHT).rows.proposals.filter((row) => row.to.getTime() > AT(95).getTime());

    expect(booked).toEqual([]);
  });

  it('still counts every token the night spent', () => {
    const day = dayOf(NIGHT);

    expect(day.spend.turns).toBe(41);
    expect(day.spend.usage.output).toBe(41 * 900);
  });

  it('proposes the evening the person did work', () => {
    expect(dayOf(EVENING).rows.proposals.map((row) => row.issueKey)).toContain('ET-772');
  });
});

describe('streamDay, on commits another machine made', () => {
  /**
   * 2026-09-12: this machine held nothing between 01:30 and 22:30 but commits a `git pull` brought in
   * from a second machine. They were drawn as three bands of work and two breaks, and the day offered
   * 3h 33m of them to Tempo.
   */
  const IMPORTED: CollectedEvent[] = [
    ...EVENING,
    commit(206, 'test(repo): Assert aria-describedby resolves'),
    commit(209, 'docs(repo): Mark the guard batch'),
    commit(229, 'fix(repo): Throw the time picker structural guards'),
    commit(513, 'docs(repo): Correct the overlay strategies'),
    commit(538, 'chore(repo): Cut the carousel comments'),
    commit(713, 'fix(repo): Report no-duration as the autoplay pause reason'),
    commit(734, 'chore(repo): Cut the calendar comments'),
  ];

  it('proposes no Tempo row for hours nothing but a commit observed', () => {
    const booked = dayOf(IMPORTED).rows.proposals.filter((row) => row.to.getTime() > AT(95).getTime());

    expect(booked).toEqual([]);
  });

  it('says why, rather than only that the band has no name', () => {
    const late = dayOf(IMPORTED).rows.unnamed.filter((row) => row.to.getTime() > AT(95).getTime());

    expect(late.length).toBeGreaterThan(0);
    expect(late.every((row) => row.unattended)).toBe(true);
  });
});

describe('streamDay, on work the user steered from a phone', () => {
  /**
   * 2026-09-15: Tom left the desk and kept prompting through Claude remote. The idle notifier saw
   * nobody at the seat for 1h 20m, and eight prompts he typed landed inside it.
   */
  const REMOTE: CollectedEvent[] = [
    ...EVENING,
    idle(90, 'idle-start'),
    ...running(90, 170),
    prompt(100, 'human'),
    prompt(115, 'human'),
    prompt(130, 'human'),
    prompt(145, 'human'),
    prompt(160, 'human'),
    commit(120, 'fix(repo): Bound what a timetrack prompt buys back off a break'),
    commit(155, 'feat(repo): Let the timetrack rules read the call lane too'),
    idle(170, 'idle-end'),
    focus(171),
    commit(175, 'docs(repo): Mark the timetrack naming gaps as built'),
  ];

  it('books what his prompts bought back off the break, and not the rest of it', () => {
    const booked = dayOf(REMOTE).rows.proposals.filter((row) => row.issueKey === 'ET-772');

    expect(booked.map((row) => [row.from, row.to])).toEqual([
      [AT(0), AT(15)],
      [AT(60), AT(90)],
      [AT(135), AT(180)],
    ]);
  });

  it('cuts the band where the break the prompts left begins and ends', () => {
    const inside = (at: Date) => at.getTime() > AT(60).getTime() && at.getTime() < AT(180).getTime();
    const edges = dayOf(REMOTE).rows.proposals.flatMap((row) => [row.from, row.to].filter(inside));

    expect(edges).toEqual([AT(90), AT(135)]);
  });

  it('draws a break no longer than the one the notifier measured', () => {
    const day = dayOf(REMOTE);
    const drawn = breaksBetweenRows({ breaks: day.breaks, rows: day.rows.proposals });

    expect(breakMs(drawn)).toBeLessThanOrEqual(breakMs(day.breaks));
  });
});

describe('streamDay, on prompts the short input idleness reads as remote', () => {
  const input = (minute: number, kind: 'input-idle' | 'input-active'): CollectedEvent => ({
    at: AT(minute),
    source: 'input',
    kind,
  });

  /**
   * 2026-09-23: Tom left the desk for three hours and steered two agents from his phone in the
   * middle of them. The seat stopped at 89 and was touched again at 240.
   */
  const AWAY: CollectedEvent[] = [
    ...EVENING,
    idle(90, 'idle-start'),
    ...running(90, 240),
    prompt(130, 'human'),
    prompt(145, 'human'),
    prompt(160, 'human'),
    idle(240, 'idle-end'),
    focus(241),
    commit(245, 'docs(repo): Mark the timetrack naming gaps as built'),
  ];
  const DESK_STOPPED: CollectedEvent[] = [
    input(0, 'input-active'),
    input(89, 'input-idle'),
    input(240, 'input-active'),
  ];

  const breaksAway = (events: CollectedEvent[]) =>
    dayOf(events)
      .breaks.filter((window) => window.from.getTime() >= AT(90).getTime())
      .map((window) => [
        (window.from.getTime() - DAY_START.getTime()) / MINUTE,
        (window.to.getTime() - DAY_START.getTime()) / MINUTE,
      ]);

  it('splits the break around the stretch he steered from the phone', () => {
    expect(breaksAway([...AWAY, ...DESK_STOPPED])).toEqual([
      [90, 115],
      [160, 241],
    ]);
  });

  const OTHER = '/home/tom/dev/fut-frontend';
  const PHONE_BRANCH = 'feat/ET-900-steer-from-the-phone';
  const steered = (minutes: number[]) =>
    minutes.flatMap((minute): CollectedEvent[] => [
      {
        at: AT(minute),
        source: 'agent-session',
        kind: 'agent-session',
        sessionId: 'phone',
        cwd: OTHER,
        gitBranch: PHONE_BRANCH,
      },
      {
        at: AT(minute),
        source: 'agent-prompt',
        kind: 'agent-prompt',
        provider: 'claude-code',
        sessionId: 'phone',
        promptId: `phone-${minute}`,
        cwd: OTHER,
        gitBranch: PHONE_BRANCH,
        askedBy: 'human',
      },
      {
        at: AT(minute + 1),
        source: 'agent-usage',
        kind: 'agent-usage',
        provider: 'claude-code',
        sessionId: 'phone',
        turnId: `phone-${minute + 1}`,
        cwd: OTHER,
        gitBranch: PHONE_BRANCH,
        model: 'claude-opus-5',
        usage: { input: 3, output: 900, cacheWrite: 200, cacheRead: 60_000, thinking: 100 },
      },
    ]);
  const steeredDay = (minutes: number[], inputs: CollectedEvent[]) =>
    streamDay({
      events: [
        ...EVENING,
        idle(90, 'idle-start'),
        ...steered(minutes),
        idle(240, 'idle-end'),
        focus(241),
        ...running(240, 270),
        focus(270),
        ...inputs,
      ].sort((a, b) => a.at.getTime() - b.at.getTime()),
      options: { repoRoots: [REPO, OTHER], windowsSeenThroughMs: AT(900).getTime(), rows: { config: CONFIG } },
    });
  const EVERY_TEN = [120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220];

  it('books the stretch as attended work rather than as unattended time', () => {
    const day = steeredDay([120, 130, 140, 150, 160], DESK_STOPPED);

    expect(day.rows.proposals.map((row) => row.issueKey)).toContain('ET-900');
    expect(day.rows.unnamed.filter((row) => row.unattended)).toEqual([]);
  });

  it('books the whole remote stretch, past the hour it once capped it at', () => {
    const day = steeredDay(EVERY_TEN, DESK_STOPPED);
    const phone = day.rows.proposals.filter((row) => row.issueKey === 'ET-900');

    expect(day.rows.unnamed.filter((row) => row.unattended)).toEqual([]);
    expect(day.breaks.filter((window) => window.from < AT(220) && window.to > AT(105))).toEqual([]);
    expect(phone.map((row) => [row.from, row.to])).toEqual([[AT(120), AT(225)]]);
    expect(phone.map((row) => row.durationMs)).toEqual([105 * MINUTE]);
  });

  it('gives a gap of more than a quarter hour between two remote prompts back to the break', () => {
    const day = steeredDay([120, 130, 140, 180, 190], DESK_STOPPED);
    const minutes = (at: Date) => (at.getTime() - AT(0).getTime()) / MINUTE;

    expect(day.breaks.map((window) => [minutes(window.from), minutes(window.to)])).toContainEqual([140, 165]);
  });

  it('leaves a reviewer no remote time the row does not book', () => {
    const review = reviewDay({ rows: steeredDay(EVERY_TEN, DESK_STOPPED).rows });
    const phone = review.rows.filter((row) => row.issueKey === 'ET-900');

    expect(phone.map((row) => [row.from, row.to, row.durationMs])).toEqual([[AT(120), AT(225), 105 * MINUTE]]);
    expect(phone.map((row) => row.unbookedMs)).toEqual([undefined]);
  });

  it('books the stretch only on the row of the session the prompts were sent to', () => {
    const STRETCH = { from: AT(105), to: AT(225) };
    const insideMs = (row: { from: Date; to: Date }) =>
      Math.max(
        0,
        Math.min(row.to.getTime(), STRETCH.to.getTime()) - Math.max(row.from.getTime(), STRETCH.from.getTime()),
      );
    const bookedInsideMs = (row: { from: Date; to: Date; durationMs: number }) =>
      row.durationMs - (row.to.getTime() - row.from.getTime() - insideMs(row));
    const review = reviewDay({ rows: steeredDay(EVERY_TEN, [...DESK_STOPPED, ...running(100, 230)]).rows });
    const parallel = review.rows.filter((row) => row.issueKey !== 'ET-900' && insideMs(row) > 0);

    expect(parallel.map((row) => row.issueKey)).toContain('ET-772');
    expect(parallel.map(bookedInsideMs)).toEqual(parallel.map(() => 0));
    expect(review.rows.reduce((sum, row) => sum + bookedInsideMs(row), 0)).toBe(105 * MINUTE);
  });

  it('books the whole span of every row on a day without the signal', () => {
    const { proposals, unnamed } = steeredDay(EVERY_TEN, []).rows;
    const rows = [...proposals, ...unnamed];

    expect(rows.filter((row) => row.durationMs !== row.to.getTime() - row.from.getTime())).toEqual([]);
  });

  it('keeps the allowance for prompts on a day without the signal', () => {
    expect(breaksAway(AWAY)).toEqual([[90, 196]]);
  });

  it('keeps the allowance for prompts typed at the desk', () => {
    const touched = [130, 145, 160].flatMap((minute) => [
      input(minute - 1, 'input-active'),
      input(minute, 'input-idle'),
    ]);

    expect(breaksAway([...AWAY, input(0, 'input-active'), input(89, 'input-idle'), ...touched])).toEqual([[90, 196]]);
  });

  it('keeps the allowance when the app was closed while the seat was idle', () => {
    const restarted = [
      input(0, 'input-active'),
      input(89, 'input-idle'),
      input(200, 'input-idle'),
      input(240, 'input-active'),
    ];

    expect(breaksAway([...AWAY, ...restarted])).toEqual([[90, 196]]);
  });
});

describe('streamDay, on an agent that ran through a lunch break', () => {
  const DISCORD = 'com.hnc.Discord';
  const call = (minute: number, kind: 'call-start' | 'call-end'): CollectedEvent => ({
    at: AT(minute),
    source: 'call',
    kind,
    appId: DISCORD,
  });

  /**
   * 2026-09-29: Tom left at 12:36 and nothing closed the idle-start. Agent sessions kept working one
   * after another for 2h 40m, and a meeting that counts as work brought him back. The gap is under
   * `DEFAULT_MAX_BREAK_MS`, and each session is a piece of its own.
   */
  const LUNCH: CollectedEvent[] = [
    ...EVENING,
    idle(90, 'idle-start'),
    ...running(95, 145, 'session-a'),
    ...running(150, 200, 'session-b'),
    ...running(205, 255, 'session-c'),
    { at: AT(257), source: 'window', kind: 'window-focus', appId: DISCORD, title: '#meeting | Braune Digital' },
    call(258, 'call-start'),
    call(300, 'call-end'),
    focus(301),
    prompt(305, 'human'),
    turn(306),
    commit(330, 'fix(repo): Keep a lunch break off the rows'),
    focus(335),
  ];
  const lunchDay = () =>
    streamDay({
      events: LUNCH.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
      options: {
        repoRoots: [REPO],
        windowsSeenThroughMs: AT(900).getTime(),
        callRules: { countsAsWork: ['Braune Digital'], neverCountsAsWork: [] },
        rows: { config: CONFIG },
      },
    });
  const inLunch = (row: { from: Date; to: Date }) =>
    row.to.getTime() > AT(95).getTime() && row.from.getTime() < AT(255).getTime();

  it('proposes one unattended row for the stretch the agents worked inside the break', () => {
    const { proposals, unnamed } = lunchDay().rows;
    const lunch = unnamed.filter(inLunch);

    expect(proposals.filter(inLunch)).toEqual([]);
    expect(lunch.map((row) => ({ unattended: row.unattended, withheld: row.withheldIssueKey }))).toEqual([
      { unattended: true, withheld: 'ET-772' },
    ]);
    expect(lunch[0]?.from.getTime()).toBeLessThanOrEqual(AT(95).getTime());
    expect(lunch[0]?.to.getTime()).toBeGreaterThanOrEqual(AT(255).getTime());
  });

  it('shows the reviewer one row nobody was there for', () => {
    const unattended = reviewDay({ rows: lunchDay().rows }).rows.filter((row) => row.unattended);

    expect(unattended.filter(inLunch)).toHaveLength(1);
  });

  it('counts the agent time as unattended and still draws the break', () => {
    const day = lunchDay();
    const drawn = breaksBetweenRows({ breaks: day.breaks, rows: day.rows.proposals, presence: day.presence });

    expect(day.unattendedMs).toBeGreaterThanOrEqual(150 * MINUTE);
    expect(drawn.some((window) => window.from <= AT(95) && window.to >= AT(255))).toBe(true);
  });
});

describe('streamDay, on a day still being collected while the user steers from a phone', () => {
  const input = (minute: number, kind: 'input-idle' | 'input-active'): CollectedEvent => ({
    at: AT(minute),
    source: 'input',
    kind,
  });
  const siblingPrompt = (minute: number, sessionId: string): CollectedEvent => ({
    at: AT(minute),
    source: 'agent-prompt',
    kind: 'agent-prompt',
    provider: 'claude-code',
    sessionId,
    promptId: `${sessionId}-${minute}`,
    cwd: REPO,
    gitBranch: BRANCH,
    askedBy: 'human',
  });

  /**
   * 2026-09-29: Tom left the desk at 15:01 and prompted two sessions of one checkout from his phone
   * at 15:21 to 15:24. He was still away when the day was read.
   */
  const AWAY: CollectedEvent[] = [
    ...EVENING,
    input(0, 'input-active'),
    input(89, 'input-idle'),
    idle(90, 'idle-start'),
    ...running(90, 130, 'session-a'),
    ...running(95, 130, 'session-b'),
    siblingPrompt(110, 'session-b'),
    siblingPrompt(111, 'session-a'),
    siblingPrompt(112, 'session-a'),
    siblingPrompt(113, 'session-a'),
    siblingPrompt(114, 'session-b'),
  ];
  const BACK: CollectedEvent[] = [
    ...AWAY,
    idle(150, 'idle-end'),
    input(150, 'input-active'),
    focus(150),
    commit(155, 'fix(repo): Read a phone prompt as remote while the user is away'),
    focus(165),
  ];

  const read = (events: CollectedEvent[], now?: Date) =>
    streamDay({
      events: events.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
      options: {
        repoRoots: [REPO],
        windowsSeenThroughMs: (now ?? AT(170)).getTime(),
        now,
        rows: { config: CONFIG, cut: { through: now } },
      },
    });
  const inAway = (row: { from: Date; to: Date }) =>
    row.to.getTime() > AT(90).getTime() && row.from.getTime() < AT(135).getTime();

  it('books the prompts as remote work before the user is back', () => {
    const { rows } = read(AWAY, AT(135));
    const unattended = rows.unnamed.filter((row) => row.unattended && inAway(row));

    expect(rows.remote?.booked.length).toBeGreaterThan(0);
    expect(unattended).toHaveLength(1);
    expect(unattended[0]?.from.getTime()).toBeGreaterThanOrEqual(AT(114).getTime());
  });

  it('reads the stretch the same once the user is back', () => {
    const live = read(AWAY, AT(135)).rows;
    const settled = read(BACK).rows;

    expect(settled.remote).toEqual(live.remote);
    expect(settled.unnamed.filter(inAway)).toEqual(live.unnamed.filter(inAway));
  });

  it('keeps a day that is over as it was without the live instant', () => {
    expect(read(AWAY).rows.remote).toEqual({ booked: [], drawn: [] });
  });
});

describe('streamDay, on an agent that ran through three breaks nobody prompted in', () => {
  const input = (minute: number, kind: 'input-idle' | 'input-active'): CollectedEvent => ({
    at: AT(minute),
    source: 'input',
    kind,
  });
  const focusEvery = (from: number, to: number) =>
    Array.from({ length: Math.floor((to - from) / 5) + 1 }, (_, step) => focus(from + step * 5));

  /**
   * 2026-10-02: one agent session ran from 09:45 to 15:00, through breaks of 12:00-12:21,
   * 13:10-13:43 and 13:58-14:45. Nobody typed a prompt in any of them.
   */
  const THROUGH: CollectedEvent[] = [
    ...focusEvery(585, 715),
    prompt(586, 'human'),
    ...running(585, 900),
    commit(650, 'feat(repo): Read the bracket seeds'),
    idle(720, 'idle-start'),
    idle(741, 'idle-end'),
    ...focusEvery(741, 785),
    prompt(760, 'human'),
    idle(790, 'idle-start'),
    idle(823, 'idle-end'),
    ...focusEvery(823, 835),
    idle(838, 'idle-start'),
    idle(885, 'idle-end'),
    ...focusEvery(885, 900),
    commit(895, 'fix(repo): Keep the bracket seeds in order'),
  ];
  const WATCHED: CollectedEvent[] = [
    input(585, 'input-active'),
    input(719, 'input-idle'),
    input(741, 'input-active'),
    input(789, 'input-idle'),
    input(823, 'input-active'),
    input(837, 'input-idle'),
    input(885, 'input-active'),
  ];
  const read = (events: CollectedEvent[], timerRuns: ClosedTimerRun[] = []) =>
    streamDay({
      events: events.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
      options: { repoRoots: [REPO], windowsSeenThroughMs: AT(960).getTime(), rows: { config: CONFIG, timerRuns } },
    });
  const overlapMs = (row: TimeWindow, windows: readonly TimeWindow[]) =>
    windowsMs(clipWindows({ windows: [row], within: windows }));
  const drawnOf = (day: ReturnType<typeof read>) =>
    breaksBetweenRows({
      breaks: day.breaks,
      rows: [...day.rows.proposals, ...day.rows.unnamed],
      presence: day.calls.filter((call) => call.isPresence),
    });
  const bookedInBreaks = (day: ReturnType<typeof read>, rows: readonly TimeWindow[]) => {
    const drawn = drawnOf(day);

    return rows.reduce((sum, row) => sum + overlapMs(row, drawn), 0);
  };
  const minutes = (rows: readonly { from: Date; to: Date; durationMs: number }[]) =>
    rows.map((row) => [row.from.getHours() * 60 + row.from.getMinutes(), row.durationMs / MINUTE]);

  it('books no row across a break nobody prompted in', () => {
    const day = read(THROUGH);
    const booked = day.rows.proposals.filter((row) => row.issueKey === 'ET-772');

    expect(minutes(booked)).toEqual([
      [585, 135],
      [735, 60],
      [825, 15],
      [885, 15],
    ]);
    expect(bookedInBreaks(day, booked)).toBe(0);
  });

  it('keeps the agent work inside each break as a row nobody was here for', () => {
    const day = read(THROUGH);
    const unattended = day.rows.unnamed.filter((row) => row.unattended);

    expect(minutes(unattended)).toEqual([
      [720, 15],
      [795, 30],
      [840, 45],
    ]);
    expect(unattended.map((row) => row.withheldIssueKey)).toEqual(['ET-772', 'ET-772', 'ET-772']);
    expect(
      checkDay({ proposals: day.rows.proposals, unattributed: day.rows.unattributed }).warnings.map(
        (warning) => warning.kind,
      ),
    ).toContain('unattended-time');
  });

  it('cuts the breaks out of a row whose start the reviewer pinned', () => {
    const day = read(THROUGH);
    const [first] = day.rows.proposals;
    const pin: PinnedRow = {
      id: 'pin:ET-772@09:45',
      replaces: first ? [first.id] : [],
      issueKey: 'ET-772',
      from: AT(585),
      to: AT(900),
      durationMs: 315 * MINUTE,
      observedMs: 315 * MINUTE,
      laneKey: first?.laneKey,
      tracksTo: true,
      description: 'Bracket seeds',
      confidence: 'certain',
      evidence: [],
    };
    const review = reviewDay({ rows: day.rows, edits: { ...EMPTY_DAY_REVIEW_EDITS, pinned: [pin] } });
    const booked = review.rows.filter((row) => row.issueKey === 'ET-772' && !row.hidden);

    expect(bookedInBreaks(day, booked)).toBe(0);
    expect(booked.reduce((sum, row) => sum + row.durationMs, 0)).toBe(225 * MINUTE);
  });

  it('writes no Tempo worklog inside a break', () => {
    const day = read(THROUGH);
    const reviewed = reviewDay({ rows: day.rows }).rows;
    const accepted = reviewed.flatMap((row) => (isNamedRow(row) ? [{ ...row, state: 'accepted' as const }] : []));
    const { creates } = planTempoSync({
      proposals: accepted,
      ledger: [],
      remote: [],
      issueIdsByKey: new Map([['ET-772', '10772']]),
    });
    const written = creates.map(({ proposal }) => proposal);

    expect(written.length).toBeGreaterThan(1);
    expect(bookedInBreaks(day, written)).toBe(0);
    expect(reviewed.filter((row) => row.unattended).length).toBe(3);
    expect(written.some((row) => row.unattended)).toBe(false);
  });

  it('cuts at the drawn break when the return rounds up past the boundary below it', () => {
    const day = read(THROUGH);
    const drawn = drawnOf(day).find((window) => window.from.getTime() === AT(795).getTime());
    const after = day.rows.proposals.find((row) => row.afterBreak && row.from >= AT(795) && row.from < AT(840));
    const inside = day.rows.unnamed.find((row) => row.unattended && row.from.getTime() === AT(795).getTime());

    expect(drawn).toEqual({ from: AT(795), to: AT(825), locked: false });
    expect(after?.from).toEqual(AT(825));
    expect(inside && [inside.from, inside.to]).toEqual([AT(795), AT(825)]);
  });

  it('keeps an edit the reviewer made on a part after a break where an older build started it', () => {
    const day = read(THROUGH);
    const after = day.rows.proposals.find((row) => row.from.getTime() === AT(825).getTime());
    const stored = `ET-772@${AT(810).toISOString()}`;
    const review = reviewDay({
      rows: day.rows,
      edits: { ...EMPTY_DAY_REVIEW_EDITS, overrides: { [stored]: { description: 'Bracket seeds by hand' } } },
    });

    expect(after?.afterBreak).toBe(true);
    expect(review.rows.find((row) => row.id === stored)).toMatchObject({
      from: AT(825),
      description: 'Bracket seeds by hand',
    });
  });

  it('still books what a prompt from the phone bought back inside a break', () => {
    const day = read([...THROUGH, ...WATCHED, prompt(860, 'human')]);
    const booked = day.rows.proposals.filter((row) => row.issueKey === 'ET-772');
    const third = { from: AT(838), to: AT(885) };

    expect(day.rows.remote?.booked).toEqual([{ from: AT(840), to: AT(855), laneKey: expect.any(String) }]);
    expect(booked.reduce((sum, row) => sum + overlapMs(row, [third]), 0)).toBeGreaterThanOrEqual(15 * MINUTE);
    expect(bookedInBreaks(day, booked)).toBe(0);
  });

  it('cuts no timer run the user started inside a break', () => {
    const run: ClosedTimerRun = { id: 'run-1', from: AT(860), to: AT(900), issueKey: 'ET-772' };
    const timed = read(THROUGH, [run]).rows.proposals.filter((row) => row.laneKey === TIMER_LANE_KEY);

    expect(timed.map((row) => [row.from.getTime() < AT(885).getTime(), row.to])).toEqual([[true, AT(900)]]);
  });
});

describe('streamDay, on an agent that finished a prompt a few minutes after the user left', () => {
  /**
   * 2026-10-08: the last prompt at 17:28, the seat idle from 17:29, the agent's turn done at 17:33,
   * and the next prompt at 18:02.
   */
  const LEFT: CollectedEvent[] = [
    ...Array.from({ length: 6 }, (_, step) => focus(1020 + step * 5)),
    prompt(1048, 'human'),
    session(1048),
    turn(1049),
    idle(1049, 'idle-start'),
    turn(1051),
    session(1053),
    prompt(1082, 'human'),
    ...running(1082, 1150),
    ...Array.from({ length: 14 }, (_, step) => focus(1082 + step * 5)),
  ];
  const leftDay = () =>
    streamDay({
      events: LEFT.slice().sort((a, b) => a.at.getTime() - b.at.getTime()),
      options: { repoRoots: [REPO], windowsSeenThroughMs: AT(1200).getTime(), rows: { config: CONFIG } },
    });
  const minutesOf = (rows: readonly { from: Date; to: Date }[]) =>
    rows.map((row) => [
      (row.from.getTime() - DAY_START.getTime()) / MINUTE,
      (row.to.getTime() - DAY_START.getTime()) / MINUTE,
    ]);

  it('keeps the increment the user left in, and draws no band for the minutes the agent ran on', () => {
    const { proposals, unnamed } = leftDay().rows;

    expect(minutesOf(proposals.filter((row) => row.from < AT(1060)))).toEqual([[1020, 1050]]);
    expect(minutesOf(unnamed.filter((row) => row.unattended))).toEqual([]);
  });
});
