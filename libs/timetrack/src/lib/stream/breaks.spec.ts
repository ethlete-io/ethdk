import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { breakMs, breakWindows } from './breaks';

const at = (hour: number, minute = 0) => new Date(2026, 8, 10, hour, minute);

const window = (from: [number, number], to: [number, number]): TimeWindow => ({
  from: at(...from),
  to: at(...to),
});

const lock = (hour: number, minute = 0): CollectedEvent =>
  ({ source: 'idle', kind: 'lock', at: at(hour, minute) }) as CollectedEvent;

const MORNING = window([9, 0], [11, 0]);
const AFTERNOON = window([12, 30], [17, 0]);

describe('breakWindows', () => {
  it('reads the gap between two stretches of presence as a break', () => {
    expect(breakWindows({ presence: [MORNING, AFTERNOON] })).toEqual([
      { from: at(11, 0), to: at(12, 30), locked: false },
    ]);
  });

  it('leaves a gap shorter than the limit to the work around it', () => {
    expect(breakWindows({ presence: [MORNING, window([11, 10], [17, 0])] })).toEqual([]);
  });

  it('reads a locked gap as a break however short it is', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([11, 5], [17, 0])],
      events: [lock(11, 1)],
    });

    expect(breaks).toEqual([{ from: at(11, 0), to: at(11, 5), locked: true }]);
  });

  it('leaves a gap the agent worked through to the unattended number', () => {
    const breaks = breakWindows({
      presence: [MORNING, AFTERNOON],
      unattended: [window([11, 30], [12, 0])],
    });

    expect(breaks).toEqual([]);
  });

  it('says nothing about a gap the user had stopped collection for', () => {
    const breaks = breakWindows({ presence: [MORNING, AFTERNOON], pauses: [window([11, 30], [12, 0])] });

    expect(breaks).toEqual([]);
  });

  it('reads no break before the first stretch or after the last', () => {
    expect(breakWindows({ presence: [MORNING] })).toEqual([]);
  });

  it('reads no break in the hours a machine was on before the day work started', () => {
    const breaks = breakWindows({
      presence: [window([1, 0], [1, 30]), MORNING, AFTERNOON],
      work: [window([9, 0], [17, 0])],
    });

    expect(breaks).toEqual([{ from: at(11, 0), to: at(12, 30), locked: false }]);
  });

  it('reads no break in the hours after the day work ended', () => {
    const breaks = breakWindows({
      presence: [MORNING, AFTERNOON, window([22, 0], [22, 30])],
      work: [window([9, 0], [17, 0])],
    });

    expect(breaks).toEqual([{ from: at(11, 0), to: at(12, 30), locked: false }]);
  });

  it('reads a gap longer than the limit as time away from the day rather than a break', () => {
    expect(breakWindows({ presence: [MORNING, window([21, 0], [22, 0])] })).toEqual([]);
  });

  it('reads a long gap as time away even when the screen was locked in it', () => {
    const breaks = breakWindows({ presence: [MORNING, window([21, 0], [22, 0])], events: [lock(11, 1)] });

    expect(breaks).toEqual([]);
  });

  it('sums the breaks it found', () => {
    expect(breakMs(breakWindows({ presence: [MORNING, AFTERNOON] }))).toBe(90 * 60_000);
  });
});
