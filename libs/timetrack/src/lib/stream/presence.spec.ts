import { describe, expect, it } from 'vitest';
import { ActivityEvent, AgentPromptEvent, AgentUsageEvent } from '../model/event';
import { PresenceSample, presenceWindows } from './presence';
import { windowsMs } from '../model/time-window';

const AT = (minutes: number) => new Date(new Date(2026, 7, 12, 9, 0, 0).getTime() + minutes * 60_000);

const MINUTE = 60_000;

const focus = (minutes: number, title = 'code'): ActivityEvent => ({
  at: AT(minutes),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title,
});

const session = (minutes: number): ActivityEvent => ({
  at: AT(minutes),
  source: 'agent-session',
  kind: 'agent-session',
  sessionId: 'session-1',
  cwd: '/home/tom/dev/ethlete-sdk',
});

const presence = (minutes: number, kind: 'idle-start' | 'idle-end' | 'pause-start' | 'pause-end'): ActivityEvent => ({
  at: AT(minutes),
  source: 'idle',
  kind,
});

const typed = (minutes: number, cwd = '/home/tom/dev/fifagg/fifagg-frontend'): AgentPromptEvent => ({
  at: AT(minutes),
  source: 'agent-prompt',
  kind: 'agent-prompt',
  provider: 'claude-code',
  sessionId: 'session-1',
  promptId: `prompt-${minutes}`,
  cwd,
});

const turn = (minutes: number): AgentUsageEvent => ({
  at: AT(minutes),
  source: 'agent-usage',
  kind: 'agent-usage',
  provider: 'claude-code',
  sessionId: 'session-1',
  turnId: `msg_${minutes}`,
  cwd: '/home/tom/dev/fifagg/fifagg-frontend',
  model: 'claude-opus-5',
  usage: { input: 1, output: 10, cacheWrite: 0, cacheRead: 500, thinking: 0 },
});

const windows = (samples: ActivityEvent[], maxUnobservedMs = 30 * MINUTE) =>
  presenceWindows({ samples, maxUnobservedMs });

const rebuilt = (samples: PresenceSample[], maxAgentGapMs = 15 * MINUTE) =>
  presenceWindows({ samples, maxUnobservedMs: 30 * MINUTE, maxAgentGapMs });

describe('presenceWindows', () => {
  it('counts nothing for an agent that ran before the user arrived', () => {
    const found = windows([session(0), session(5), session(10), presence(11, 'idle-end'), focus(11), focus(20)]);

    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({ from: AT(11), to: AT(20) });
  });

  it('ends a stretch at its last sample, not at the next one', () => {
    const found = windows([focus(0), focus(10), focus(100)]);

    expect(found).toEqual([
      { from: AT(0), to: AT(10) },
      { from: AT(100), to: AT(100) },
    ]);
  });

  it('ends a stretch where the user asked not to be watched', () => {
    const found = windows([focus(0), presence(10, 'pause-start'), session(20), presence(30, 'pause-end'), focus(31)]);

    expect(windowsMs(found)).toBe(10 * MINUTE);
    expect(found[0]).toEqual({ from: AT(0), to: AT(10) });
  });

  it('takes a focus change as the resume the idle notifier missed', () => {
    const found = windows([focus(0), presence(5, 'idle-start'), focus(20), focus(30)]);

    expect(found).toEqual([
      { from: AT(0), to: AT(5) },
      { from: AT(20), to: AT(30) },
    ]);
  });

  it('takes the titles an agent changed through a stretch the idle notifier did close as no resume', () => {
    const found = windows([
      focus(0, 'lanes.ts'),
      presence(5, 'idle-start'),
      focus(20, 'presence.ts'),
      focus(30, 'breaks.ts'),
      presence(60, 'idle-end'),
      focus(61, 'stream-day.ts'),
    ]);

    expect(found).toEqual([
      { from: AT(0), to: AT(5) },
      { from: AT(61), to: AT(61) },
    ]);
  });

  it('never overlaps, so presence can be summed', () => {
    const found = windows([focus(0), focus(1), presence(2, 'idle-start'), presence(3, 'idle-end'), focus(4)]);

    expect(found.every((window, index) => index === 0 || found[index - 1]!.to <= window.from)).toBe(true);
  });
});

describe('presenceWindows, rebuilding a day nothing observed', () => {
  it('opens and extends a stretch on the prompts the user typed', () => {
    expect(rebuilt([typed(0), typed(10), typed(20)])).toEqual([{ from: AT(0), to: AT(20) }]);
  });

  it('holds a stretch open across the minutes an agent worked between two prompts', () => {
    expect(rebuilt([typed(0), turn(10), turn(20), typed(25)])).toEqual([{ from: AT(0), to: AT(25) }]);
  });

  it('ends the stretch at the last prompt, never at the last turn', () => {
    expect(rebuilt([typed(0), typed(10), turn(20), turn(30)])).toEqual([{ from: AT(0), to: AT(10) }]);
  });

  it('splits the day where neither a prompt nor a turn came for the agent gap', () => {
    expect(rebuilt([typed(0), typed(10), typed(40), typed(50)])).toEqual([
      { from: AT(0), to: AT(10) },
      { from: AT(40), to: AT(50) },
    ]);
  });

  it('counts nothing for turns alone, whatever their number', () => {
    expect(rebuilt([turn(0), turn(10), turn(20), turn(30)])).toEqual([]);
  });

  it('counts nothing for an agent that ran while the user was away', () => {
    expect(rebuilt([typed(0), presence(5, 'idle-start'), turn(10), turn(20), typed(30)])).toEqual([
      { from: AT(0), to: AT(5) },
      { from: AT(30), to: AT(30) },
    ]);
  });

  it('takes a prompt as the resume the idle notifier missed', () => {
    expect(rebuilt([focus(0), presence(5, 'idle-start'), typed(20), typed(30)])).toEqual([
      { from: AT(0), to: AT(5) },
      { from: AT(20), to: AT(30) },
    ]);
  });

  it('applies the agent gap either side of an agent event, and the safety valve between samples', () => {
    expect(rebuilt([focus(0), typed(20)])).toEqual([
      { from: AT(0), to: AT(0) },
      { from: AT(20), to: AT(20) },
    ]);
    expect(rebuilt([focus(0), focus(20)])).toEqual([{ from: AT(0), to: AT(20) }]);
  });
});
