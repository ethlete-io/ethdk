import { describe, expect, it } from 'vitest';
import { DayBoundary, MIDNIGHT, byLocalDay, dayKeysThrough, localDayKey, localDayRange, shiftDayKey } from './day';

describe('localDayKey', () => {
  it('names the day the instant falls in locally, not in UTC', () => {
    expect(localDayKey(new Date(2026, 7, 11, 23, 30), MIDNIGHT)).toBe('2026-08-11');
    expect(localDayKey(new Date(2026, 7, 11, 0, 15), MIDNIGHT)).toBe('2026-08-11');
  });

  it('pads a single-digit month and day', () => {
    expect(localDayKey(new Date(2026, 0, 5), MIDNIGHT)).toBe('2026-01-05');
  });
});

describe('localDayRange', () => {
  it('covers the whole day and stops at the next midnight', () => {
    const { from, to } = localDayRange('2026-08-11', MIDNIGHT);

    expect(from).toEqual(new Date(2026, 7, 11));
    expect(to).toEqual(new Date(2026, 7, 12));
  });

  it('rolls over a month end', () => {
    expect(localDayRange('2026-08-31', MIDNIGHT).to).toEqual(new Date(2026, 8, 1));
  });
});

describe('shiftDayKey', () => {
  it('moves across a month end in both directions', () => {
    expect(shiftDayKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDayKey('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('moves across a year end', () => {
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('round-trips a day key it produced', () => {
    expect(shiftDayKey(shiftDayKey('2026-08-11', 7), -7)).toBe('2026-08-11');
  });
});

describe('dayKeysThrough', () => {
  it('ends at the day it was given, and counts back from it', () => {
    expect(dayKeysThrough({ day: '2026-09-09', count: 3 })).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
  });

  it('crosses a month end', () => {
    expect(dayKeysThrough({ day: '2026-09-01', count: 2 })).toEqual(['2026-08-31', '2026-09-01']);
  });

  it('reads one day as itself', () => {
    expect(dayKeysThrough({ day: '2026-09-09', count: 1 })).toEqual(['2026-09-09']);
  });
});

describe('byLocalDay', () => {
  const at = (day: number, hour: number) => ({ at: new Date(2026, 8, day, hour) });

  it('gives one array per day asked about, in the order they were asked', () => {
    const grouped = byLocalDay({
      boundary: MIDNIGHT,
      items: [at(8, 10), at(9, 9), at(9, 17)],
      days: ['2026-09-08', '2026-09-09'],
    });

    expect(grouped).toEqual([[at(8, 10)], [at(9, 9), at(9, 17)]]);
  });

  it('gives an empty array for a day nothing happened on', () => {
    expect(byLocalDay({ boundary: MIDNIGHT, items: [at(9, 9)], days: ['2026-09-07', '2026-09-09'] })).toEqual([
      [],
      [at(9, 9)],
    ]);
  });

  it('drops an item outside every day it was asked about', () => {
    expect(byLocalDay({ boundary: MIDNIGHT, items: [at(1, 9), at(9, 9)], days: ['2026-09-09'] })).toEqual([[at(9, 9)]]);
  });

  it('keeps a late evening on its own day rather than on the next one', () => {
    const grouped = byLocalDay({
      boundary: MIDNIGHT,
      items: [at(8, 23), at(9, 0)],
      days: ['2026-09-08', '2026-09-09'],
    });

    expect(grouped).toEqual([[at(8, 23)], [at(9, 0)]]);
  });
});

describe('a day that starts at a configured hour', () => {
  const FOUR: DayBoundary = { startHour: 4 };

  it('keeps work past midnight on the evening it came from', () => {
    expect(localDayKey(new Date(2026, 8, 9, 23, 30), FOUR)).toBe('2026-09-09');
    expect(localDayKey(new Date(2026, 8, 10, 1, 15), FOUR)).toBe('2026-09-09');
    expect(localDayKey(new Date(2026, 8, 10, 4, 0), FOUR)).toBe('2026-09-10');
  });

  it('runs a day from the boundary to the next one', () => {
    const { from, to } = localDayRange('2026-09-09', FOUR);

    expect(from).toEqual(new Date(2026, 8, 9, 4));
    expect(to).toEqual(new Date(2026, 8, 10, 4));
  });

  it('steps a key by whole days whatever the boundary is', () => {
    expect(shiftDayKey('2026-09-09', 1)).toBe('2026-09-10');
  });

  it('groups an evening that crossed midnight into one day', () => {
    const at = (day: number, hour: number) => ({ at: new Date(2026, 8, day, hour) });
    const grouped = byLocalDay({
      boundary: FOUR,
      items: [at(9, 22), at(10, 1), at(10, 9)],
      days: ['2026-09-09', '2026-09-10'],
    });

    expect(grouped).toEqual([[at(9, 22), at(10, 1)], [at(10, 9)]]);
  });
});
