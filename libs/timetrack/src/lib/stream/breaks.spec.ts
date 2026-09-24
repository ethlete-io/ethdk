import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { TimeWindow } from '../model/time-window';
import { breakMs, breakWindows, bookedRemoteWindows, breaksBetweenRows } from './breaks';

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

  it('takes the attention a prompt ending the break took off it', () => {
    expect(breakWindows({ presence: [MORNING, AFTERNOON], prompts: [at(12, 30)] })).toEqual([
      { from: at(11, 0), to: at(12, 15), locked: false },
    ]);
  });

  it('never lets the prompts take a break below the limit that made it one', () => {
    expect(breakWindows({ presence: [MORNING, window([11, 20], [17, 0])], prompts: [at(11, 20)] })).toEqual([
      { from: at(11, 0), to: at(11, 15), locked: false },
    ]);
  });

  it('buys nothing back off a break that is already the shortest one reported', () => {
    expect(breakWindows({ presence: [MORNING, window([11, 15], [17, 0])], prompts: [at(11, 15)] })).toEqual([
      { from: at(11, 0), to: at(11, 15), locked: false },
    ]);
  });

  it('shortens a break from its end rather than punching a hole in it', () => {
    expect(breakWindows({ presence: [MORNING, window([14, 0], [17, 0])], prompts: [at(12, 30)] })).toEqual([
      { from: at(11, 0), to: at(13, 45), locked: false },
    ]);
  });

  it('buys back one allowance for two prompts inside the same one', () => {
    expect(breakWindows({ presence: [MORNING, AFTERNOON], prompts: [at(12, 25), at(12, 30)] })).toEqual([
      { from: at(11, 0), to: at(12, 10), locked: false },
    ]);
  });

  it('never lets the prompts buy back more than half a break', () => {
    expect(breakWindows({ presence: [MORNING, window([11, 30], [17, 0])], prompts: [at(11, 1), at(11, 29)] })).toEqual([
      { from: at(11, 0), to: at(11, 15), locked: false },
    ]);
  });

  it('buys nothing back for a prompt sent outside the break', () => {
    expect(breakWindows({ presence: [MORNING, AFTERNOON], prompts: [at(9, 30), at(16, 0)] })).toEqual([
      { from: at(11, 0), to: at(12, 30), locked: false },
    ]);
  });

  it('keeps a locked break whole, whatever the user typed afterwards', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([11, 5], [17, 0])],
      events: [lock(11, 1)],
      prompts: [at(11, 5)],
    });

    expect(breaks).toEqual([{ from: at(11, 0), to: at(11, 5), locked: true }]);
  });

  it('counts the stretch from the first remote prompt to the last as work, past the half-break cap', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([14, 0], [17, 0])],
      remotePrompts: [at(11, 20), at(12, 10), at(13, 40)],
    });

    expect(breaks).toEqual([{ from: at(13, 40), to: at(14, 0), locked: false }]);
  });

  it('splits a break a remote stretch sits in the middle of', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([14, 0], [17, 0])],
      remotePrompts: [at(12, 0), at(12, 30)],
    });

    expect(breaks).toEqual([
      { from: at(11, 0), to: at(11, 45), locked: false },
      { from: at(12, 30), to: at(14, 0), locked: false },
    ]);
  });

  it('drops what a remote stretch leaves of a break under the limit', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([12, 0], [17, 0])],
      remotePrompts: [at(11, 20), at(11, 50)],
    });

    expect(breaks).toEqual([]);
  });

  it('cuts a remote stretch out of a locked break as well', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([14, 0], [17, 0])],
      events: [lock(11, 1)],
      remotePrompts: [at(12, 0), at(12, 30)],
    });

    expect(breaks).toEqual([
      { from: at(11, 0), to: at(11, 45), locked: true },
      { from: at(12, 30), to: at(14, 0), locked: true },
    ]);
  });

  it('still caps a desk prompt beside a remote stretch at the part it ends', () => {
    const breaks = breakWindows({
      presence: [MORNING, window([14, 0], [17, 0])],
      remotePrompts: [at(11, 30)],
      prompts: [at(14, 0)],
    });

    expect(breaks).toEqual([
      { from: at(11, 0), to: at(11, 15), locked: false },
      { from: at(11, 30), to: at(13, 45), locked: false },
    ]);
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

describe('bookedRemoteWindows', () => {
  const prompts = (...instants: Date[]) => instants.map((instant) => ({ at: instant }));

  it('books each remote prompt its allowance and leaves the stretch between them unbooked', () => {
    const booked = bookedRemoteWindows({
      breaks: [window([11, 0], [14, 0])],
      remotePrompts: prompts(at(11, 30), at(12, 0), at(12, 30)),
    });

    expect(booked).toEqual([window([11, 15], [11, 30]), window([11, 45], [12, 0]), window([12, 15], [12, 30])]);
  });

  it('gives the hour to the earliest prompts, counts overlapping allowances once, and leaves the rest unbooked', () => {
    const booked = bookedRemoteWindows({
      breaks: [window([11, 0], [14, 0])],
      remotePrompts: prompts(at(11, 30), at(11, 35), at(11, 50), at(12, 5), at(12, 20), at(12, 50)),
    });

    expect(booked).toEqual([
      window([11, 15], [11, 30]),
      window([11, 30], [11, 35]),
      window([11, 35], [11, 50]),
      window([11, 50], [12, 5]),
      window([12, 10], [12, 20]),
    ]);
  });

  it('counts the hour across every break of the day', () => {
    const booked = bookedRemoteWindows({
      breaks: [window([11, 0], [12, 30]), window([13, 0], [15, 0])],
      remotePrompts: prompts(at(11, 30), at(11, 45), at(12, 0), at(13, 30), at(13, 45), at(14, 0)),
    });

    expect(booked).toEqual([
      window([11, 15], [11, 30]),
      window([11, 30], [11, 45]),
      window([11, 45], [12, 0]),
      window([13, 15], [13, 30]),
    ]);
  });

  it('takes the daily limit from the options', () => {
    const booked = bookedRemoteWindows({
      breaks: [window([11, 0], [14, 0])],
      remotePrompts: prompts(at(11, 30), at(12, 0), at(12, 30)),
      maxRemoteAttentionMs: 30 * 60_000,
    });

    expect(booked).toEqual([window([11, 15], [11, 30]), window([11, 45], [12, 0])]);
  });

  it('keeps the lane of the prompt that bought each part', () => {
    const booked = bookedRemoteWindows({
      breaks: [window([11, 0], [14, 0])],
      remotePrompts: [
        { at: at(11, 30), laneKey: 'repo:/a' },
        { at: at(11, 40), laneKey: 'repo:/b' },
      ],
    });

    expect(booked).toEqual([
      { ...window([11, 15], [11, 30]), laneKey: 'repo:/a' },
      { ...window([11, 30], [11, 40]), laneKey: 'repo:/b' },
    ]);
  });
});

describe('breaksBetweenRows, against the calls the user attended', () => {
  it('clips back the part of a break the snap pushed into a call', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 38], [13, 8]), locked: false }],
      rows: [window([9, 0], [17, 0])],
      presence: [window([11, 0], [12, 52])],
    });

    expect(drawn).toEqual([{ ...window([13, 0], [13, 15]), locked: false }]);
  });

  it('drops the break whole when the call leaves less than one increment of it', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 38], [12, 53]), locked: false }],
      rows: [window([9, 0], [17, 0])],
      presence: [window([11, 0], [12, 52])],
    });

    expect(drawn).toEqual([]);
  });

  it('leaves a break no call covers exactly where the snap put it', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 38], [12, 53]), locked: false }],
      rows: [window([9, 0], [17, 0])],
      presence: [window([9, 0], [10, 0])],
    });

    expect(drawn).toEqual([{ ...window([12, 45], [13, 0]), locked: false }]);
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

  it('draws a break the rows leave no gap for on the increment itself', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 4], [12, 20]), locked: false }],
      rows: [window([9, 0], [12, 30]), window([12, 30], [17, 0])],
    });

    expect(drawn).toEqual([{ from: at(12, 0), to: at(12, 15), locked: false }]);
  });

  it('keeps one increment for a break whose ends round to the same boundary', () => {
    const drawn = breaksBetweenRows({
      breaks: [{ ...window([12, 38], [12, 53]), locked: false }],
      rows: [window([9, 0], [17, 0])],
    });

    expect(drawn).toEqual([{ from: at(12, 45), to: at(13, 0), locked: false }]);
  });

  it('draws both the gap the rows leave and the break an agent ran through', () => {
    const drawn = breaksBetweenRows({
      breaks: [
        { ...window([10, 4], [10, 20]), locked: false },
        { ...window([12, 4], [13, 25]), locked: false },
      ],
      rows: [window([9, 0], [12, 0]), window([13, 30], [17, 0])],
    });

    expect(drawn).toEqual([
      { from: at(10, 0), to: at(10, 15), locked: false },
      { from: at(12, 0), to: at(13, 30), locked: false },
    ]);
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
