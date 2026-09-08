import { describe, expect, it } from 'vitest';
import { ActivityEvent } from '../model/event';
import { presenceWindows } from './presence';
import { windowsMs } from './windows';

const AT = (minutes: number) => new Date(new Date(2026, 7, 12, 9, 0, 0).getTime() + minutes * 60_000);

const MINUTE = 60_000;

const focus = (minutes: number): ActivityEvent => ({
  at: AT(minutes),
  source: 'window',
  kind: 'window-focus',
  appId: 'code',
  title: 'code',
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

const windows = (samples: ActivityEvent[], maxUnobservedMs = 30 * MINUTE) =>
  presenceWindows({ samples, maxUnobservedMs });

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

  it('never overlaps, so presence can be summed', () => {
    const found = windows([focus(0), focus(1), presence(2, 'idle-start'), presence(3, 'idle-end'), focus(4)]);

    expect(found.every((window, index) => index === 0 || found[index - 1]!.to <= window.from)).toBe(true);
  });
});
