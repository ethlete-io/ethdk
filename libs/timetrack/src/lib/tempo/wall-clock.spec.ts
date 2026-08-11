import { describe, expect, it } from 'vitest';
import { parseTempoWallClock, tempoDay, tempoTimeOfDay } from './wall-clock';

describe('tempoDay', () => {
  it('formats the local calendar day, zero-padded', () => {
    expect(tempoDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('reports the day the user sees, whatever the UTC offset does to it', () => {
    expect(tempoDay(new Date(2026, 7, 11, 23, 45))).toBe('2026-08-11');
    expect(tempoDay(new Date(2026, 7, 11, 0, 15))).toBe('2026-08-11');
  });
});

describe('tempoTimeOfDay', () => {
  it('formats hours, minutes and seconds', () => {
    expect(tempoTimeOfDay(new Date(2026, 7, 11, 9, 5, 7))).toBe('09:05:07');
  });
});

describe('parseTempoWallClock', () => {
  it('reads the date and the time of day as local wall clock', () => {
    const parsed = parseTempoWallClock('2026-08-11', '09:30:00');

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(7);
    expect(parsed?.getDate()).toBe(11);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('defaults a missing time of day to midnight', () => {
    expect(parseTempoWallClock('2026-08-11', undefined)?.getHours()).toBe(0);
  });

  it('accepts a time without seconds', () => {
    expect(parseTempoWallClock('2026-08-11', '09:30')?.getMinutes()).toBe(30);
  });

  it('round-trips what the write side formats', () => {
    const from = new Date(2026, 7, 11, 14, 15, 0);

    expect(parseTempoWallClock(tempoDay(from), tempoTimeOfDay(from))?.getTime()).toBe(from.getTime());
  });

  it('returns undefined for anything that is not the documented shape', () => {
    expect(parseTempoWallClock('11.08.2026', '09:30:00')).toBeUndefined();
    expect(parseTempoWallClock('2026-08-11', 'half nine')).toBeUndefined();
    expect(parseTempoWallClock(undefined, '09:30:00')).toBeUndefined();
  });
});
