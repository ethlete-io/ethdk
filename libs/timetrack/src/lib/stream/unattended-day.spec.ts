import { resolveGitFlowConfig } from '@ethlete/agent-rules/git-flow';
import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
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
