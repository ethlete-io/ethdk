import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { breakMs, breakWindows, breaksBetweenRows } from './breaks';

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

describe('breaksBetweenRows', () => {
  it('draws the break as the gap between the rows around it, not as it was measured', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 4], [13, 25]), locked: false }],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([{ from: at(12, 0), to: at(13, 30), locked: false }]);
  });

  it('keeps the lock of the break the gap holds', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 4], [13, 25]), locked: true }],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([{ from: at(12, 0), to: at(13, 30), locked: true }]);
  });

  it('drops a break the rows leave no gap for', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 4], [12, 20]), locked: false }],
      rows: [window([9, 0], [12, 30]), window([12, 30], [17, 0])],
    });

    expect(drawn).toEqual([]);
  });

  it('says nothing about a gap no break was measured in', () => {
    const drawn = breaksBetweenRows({
      breaks: [],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([]);
  });

  it('reads one gap that two measured breaks fall in as one break', () => {
    const drawn = breaksBetweenRows({
      breaks: [
        { ...window([12, 4], [12, 40]), locked: false },
        { ...window([12, 50], [13, 25]), locked: true },
      ],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([{ from: at(12, 0), to: at(13, 30), locked: true }]);
  });

  it('returns the measured breaks when there are no rows to read a gap from', () => {
    const measured = [{ ...window([12, 4], [13, 25]), locked: false }];

    expect(breaksBetweenRows({ breaks: measured, rows: [] })).toEqual(measured);
  });

  it('never draws a break outside the rows, however early the machine was left', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([8, 0], [8, 40]), locked: false }],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([]);
  });
});
