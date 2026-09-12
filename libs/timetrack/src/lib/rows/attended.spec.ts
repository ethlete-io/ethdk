import { describe, expect, it } from 'vitest';
import { ActivityBlock } from '../model/block';
import { CollectedEvent } from '../model/event';
import { WorkGroup } from './merge';
import { attendedAt, markAttendance } from './attended';

const AT = (minute: number) => new Date(2026, 8, 12, 0, minute, 0);
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

describe('attendedAt', () => {
  it('reads a window and an idle transition as a person', () => {
    expect(attendedAt([focus(5), { at: AT(9), source: 'idle', kind: 'idle-end' }])).toHaveLength(2);
  });

  it('reads a prompt a person gave, and refuses one an agent gave itself', () => {
    expect(attendedAt([prompt(5, 'human')])).toHaveLength(1);
    expect(attendedAt([prompt(5, 'machine')])).toEqual([]);
  });

  it('refuses a commit and a turn, which say the machine worked and not who was there', () => {
    expect(attendedAt([commit(5), turn(6)])).toEqual([]);
  });
});

describe('markAttendance', () => {
  it('marks a band holding one instant of a person as attended', () => {
    const marked = markAttendance({ groups: [group(0, 60)], at: attendedAt([focus(30)]) });

    expect(marked[0]?.attended).toBe(true);
  });

  it('marks a band nothing but a commit and a turn covered as unattended', () => {
    const marked = markAttendance({ groups: [group(0, 60)], at: attendedAt([commit(30), turn(40)]) });

    expect(marked[0]?.attended).toBe(false);
  });

  it('does not let one band lend its attendance to another', () => {
    const marked = markAttendance({ groups: [group(0, 60), group(200, 260)], at: attendedAt([focus(30)]) });

    expect(marked.map((entry) => entry.attended)).toEqual([true, false]);
  });

  it('takes a stretch the user claimed by hand as attended, whatever the events say', () => {
    const marked = markAttendance({
      groups: [group(200, 260)],
      at: attendedAt([focus(30)]),
      claimed: [{ from: AT(210), to: AT(240) }],
    });

    expect(marked[0]?.attended).toBe(true);
  });
});
