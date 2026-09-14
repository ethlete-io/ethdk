import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { WorkGroup } from './merge';
import { attendedAt, markAttendance } from './attended';

const AT = (minute: number) => new Date(2026, 8, 12, 0, minute, 0);
const GRACE = 15 * 60_000;
const REPO = '/home/tom/dev/ethlete-sdk';

const focus = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'presence.ts - ethlete-sdk - Code',
});

const commit = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'git',
  kind: 'git-commit',
  repoPath: REPO,
  branch: 'next',
  sha: `sha-${minute}`,
  subject: 'chore(repo): Cut the cascader comments',
});

const turn = (minute: number): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: 'session-1',
  turnId: `msg-${minute}`,
  cwd: REPO,
  model: 'claude-opus-5',
  usage: { input: 1, output: 10, cacheWrite: 0, cacheRead: 5, thinking: 0 },
});

const idleStart = (minute: number): CollectedEvent => ({ at: AT(minute), source: 'idle', kind: 'idle-start' });

const idleEnd = (minute: number): CollectedEvent => ({ at: AT(minute), source: 'idle', kind: 'idle-end' });

const prompt = (minute: number, askedBy: 'human' | 'machine'): CollectedEvent => ({
  at: AT(minute),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: 'session-1',
  promptId: `prompt-${minute}`,
  cwd: REPO,
  askedBy,
});

const block = (from: number, to: number): ActivityBlock => ({
  from: AT(from),
  to: AT(to),
  context: { repoPath: REPO, branch: 'next' },
  evidence: [],
});

const group = (from: number, to: number): WorkGroup => ({
  from: AT(from),
  to: AT(to),
  observedMs: (to - from) * 60_000,
  confidence: 'likely',
  evidence: [],
  blocks: [block(from, to)],
});

const present = (events: readonly CollectedEvent[], graceMs = GRACE) => attendedAt({ events, graceMs });

describe('attendedAt', () => {
  it('widens a window a person brought to the front by the grace either side', () => {
    expect(present([focus(30)])).toEqual([{ from: AT(15), to: AT(45) }]);
  });

  it('reads a prompt a person gave, and refuses a commit, a turn and a prompt an agent gave itself', () => {
    expect(present([prompt(30, 'human')])).toHaveLength(1);
    expect(present([commit(30), turn(40), prompt(30, 'machine')])).toEqual([]);
  });

  it('drops the focus change the compositor reports as the session goes idle', () => {
    const windows = present([idleStart(30), focus(31), idleEnd(90)]);

    expect(windows.some((window) => window.from < AT(90) && window.to > AT(30))).toBe(false);
  });

  it('stops the grace dead at either edge of a stretch nobody was watching', () => {
    expect(present([focus(20), idleStart(30), idleEnd(90), focus(91)])).toEqual([
      { from: AT(5), to: AT(30) },
      { from: AT(90), to: AT(106) },
    ]);
  });
});

describe('markAttendance', () => {
  it('marks a band holding one instant of a person as attended', () => {
    const marked = markAttendance({ groups: [group(0, 60)], at: present([focus(30)]) });

    expect(marked[0]?.attended).toBe(true);
  });

  it('marks a band nothing but a commit and a turn covered as unattended', () => {
    const marked = markAttendance({ groups: [group(0, 60)], at: present([commit(30), turn(40)]) });

    expect(marked[0]?.attended).toBe(false);
  });

  it('does not let one band lend its attendance to another', () => {
    const marked = markAttendance({ groups: [group(0, 60), group(200, 260)], at: present([focus(30)]) });

    expect(marked.map((entry) => entry.attended)).toEqual([true, false]);
  });

  it('takes a stretch the user claimed by hand as attended, whatever the events say', () => {
    const marked = markAttendance({
      groups: [group(200, 260)],
      at: present([focus(30)]),
      claimed: [{ from: AT(210), to: AT(240) }],
    });

    expect(marked[0]?.attended).toBe(true);
  });

  it('marks the band a ten-minute absence left behind as attended, from the work either side of it', () => {
    const marked = markAttendance({ groups: [group(15, 30)], at: present([focus(9), focus(38)]) });

    expect(marked[0]?.attended).toBe(true);
  });

  it('is the grace and nothing else that answers for that band', () => {
    const marked = markAttendance({ groups: [group(15, 30)], at: present([focus(9), focus(38)], 0) });

    expect(marked[0]?.attended).toBe(false);
  });

  it('leaves the bands of a break unattended, on either side of the stretch nobody watched', () => {
    const marked = markAttendance({
      groups: [group(10, 22), group(30, 45), group(45, 60), group(77, 90)],
      at: present([idleStart(22), focus(23), idleEnd(77), focus(78)]),
    });

    expect(marked.map((entry) => entry.attended)).toEqual([true, false, false, true]);
  });

  it('leaves a run nobody came within the grace of unattended, however long it is', () => {
    const marked = markAttendance({ groups: [group(300, 540)], at: present([focus(30)]) });

    expect(marked[0]?.attended).toBe(false);
  });
});
