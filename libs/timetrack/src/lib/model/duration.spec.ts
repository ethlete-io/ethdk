import { describe, expect, it } from 'vitest';
import { READABLE_MS, formatDurationMs, formatTimeOfDay } from './duration';

describe('formatDurationMs', () => {
  it('reads nothing as 0m', () => {
    expect(formatDurationMs(0)).toBe('0m');
    expect(formatDurationMs(READABLE_MS - 1)).toBe('0m');
    expect(formatDurationMs(READABLE_MS)).toBe('1m');
  });

  it('rounds a minute short of the hour up to the hour', () => {
    expect(formatDurationMs(59 * 60_000 + 30_000)).toBe('1h 0m');
  });

  it('reads a day longer than 24 hours in hours', () => {
    expect(formatDurationMs(25 * 3_600_000 + 5 * 60_000)).toBe('25h 5m');
  });
});

describe('formatTimeOfDay', () => {
  it('pads midnight and single-digit hours', () => {
    expect(formatTimeOfDay(new Date(2026, 7, 11, 0, 0))).toBe('00:00');
    expect(formatTimeOfDay(new Date(2026, 7, 11, 9, 5))).toBe('09:05');
    expect(formatTimeOfDay(new Date(2026, 7, 11, 23, 59, 59))).toBe('23:59');
  });
});
