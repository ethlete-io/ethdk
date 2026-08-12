import { describe, expect, it } from 'vitest';
import { localDayKey, localDayRange, shiftDayKey } from './day';

describe('localDayKey', () => {
  it('names the day the instant falls in locally, not in UTC', () => {
    expect(localDayKey(new Date(2026, 7, 11, 23, 30))).toBe('2026-08-11');
    expect(localDayKey(new Date(2026, 7, 11, 0, 15))).toBe('2026-08-11');
  });

  it('pads a single-digit month and day', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('localDayRange', () => {
  it('covers the whole day and stops at the next midnight', () => {
    const { from, to } = localDayRange('2026-08-11');

    expect(from).toEqual(new Date(2026, 7, 11));
    expect(to).toEqual(new Date(2026, 7, 12));
  });

  it('rolls over a month end', () => {
    expect(localDayRange('2026-08-31').to).toEqual(new Date(2026, 8, 1));
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
