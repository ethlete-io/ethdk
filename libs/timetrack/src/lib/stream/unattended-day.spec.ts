import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
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

const session = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: SESSION,
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

const turn = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: SESSION,
  turnId: `msg-${minute}`,
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
const running = (from: number, to: number): CollectedEvent[] =>
  Array.from({ length: Math.floor((to - from) / 10) + 1 }, (_, step) => [
    session(from + step * 10),
    turn(from + step * 10),
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

  it('books the time the agent worked while he steered it', () => {
    const booked = dayOf(REMOTE).rows.proposals.filter((row) => row.issueKey === 'ET-772');

    expect(booked.some((row) => row.from.getTime() <= AT(100).getTime() && row.to.getTime() >= AT(160).getTime())).toBe(
      true,
    );
  });

  it('draws one band across the window rather than cutting it in two', () => {
    const inside = (at: Date) => at.getTime() > AT(90).getTime() && at.getTime() < AT(170).getTime();
    const edges = dayOf(REMOTE).rows.proposals.flatMap((row) => [row.from, row.to].filter(inside));

    expect(edges).toEqual([]);
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

  it('draws the whole remote stretch as work, past the hour it books', () => {
    const day = steeredDay(EVERY_TEN, DESK_STOPPED);
    const phone = day.rows.proposals.filter((row) => row.issueKey === 'ET-900');

    expect(day.rows.unnamed.filter((row) => row.unattended)).toEqual([]);
    expect(day.breaks.filter((window) => window.from < AT(220) && window.to > AT(105))).toEqual([]);
    expect(phone.map((row) => [row.from, row.to])).toEqual([[AT(120), AT(225)]]);
    expect(phone.map((row) => row.durationMs)).toEqual([45 * MINUTE]);
  });

  it('keeps the booking a reviewer reads under the hour of remote allowance', () => {
    const review = reviewDay({ rows: steeredDay(EVERY_TEN, DESK_STOPPED).rows });
    const phone = review.rows.filter((row) => row.issueKey === 'ET-900');

    expect(phone.map((row) => [row.from, row.to, row.durationMs])).toEqual([[AT(120), AT(225), 45 * MINUTE]]);
  });

  it('books the hour only on the row of the session the prompts were sent to', () => {
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
    expect(review.rows.reduce((sum, row) => sum + bookedInsideMs(row), 0)).toBe(45 * MINUTE);
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
