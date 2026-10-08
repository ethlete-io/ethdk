import { describe, expect, it } from 'vitest';
import { clockDisplayFormat, formatClock, formatDate, formatDateRange } from './display';

const WEDNESDAY = new Date(2026, 9, 7, 21, 5, 9);
const MIDNIGHT = new Date(2026, 9, 7, 0, 5);
const NOON = new Date(2026, 9, 7, 12, 30);

describe('formatDate', () => {
  it('writes day-month with the day first', () => {
    expect(formatDate(WEDNESDAY, { style: 'day-month', width: 'long', weekday: true })).toBe('Wednesday, 7 October');
    expect(formatDate(WEDNESDAY, { style: 'day-month', width: 'short', weekday: true })).toBe('Wed, 7 Oct');
    expect(formatDate(WEDNESDAY, { style: 'day-month', width: 'short', year: true })).toBe('7 Oct 2026');
  });

  it('writes month-day with the month first', () => {
    expect(formatDate(WEDNESDAY, { style: 'month-day', width: 'long', weekday: true })).toBe('Wednesday, October 7');
    expect(formatDate(WEDNESDAY, { style: 'month-day', width: 'short', weekday: true })).toBe('Wed, Oct 7');
    expect(formatDate(WEDNESDAY, { style: 'month-day', width: 'short', year: true })).toBe('Oct 7, 2026');
  });

  it('writes ISO without names', () => {
    expect(formatDate(WEDNESDAY, { style: 'iso', width: 'long', weekday: true })).toBe('2026-10-07');
    expect(formatDate(new Date(2026, 0, 3), { style: 'iso', width: 'short' })).toBe('2026-01-03');
  });
});

describe('formatDateRange', () => {
  const from = new Date(2026, 9, 5);
  const to = new Date(2026, 9, 11);

  it('puts the year on the end only', () => {
    expect(formatDateRange({ from, to, style: 'day-month' })).toBe('5 Oct – 11 Oct 2026');
    expect(formatDateRange({ from, to, style: 'month-day' })).toBe('Oct 5 – Oct 11, 2026');
    expect(formatDateRange({ from, to, style: 'iso' })).toBe('2026-10-05 – 2026-10-11');
  });
});

describe('formatClock', () => {
  it('writes 24h with a padded hour', () => {
    expect(formatClock(WEDNESDAY, { clock: '24h' })).toBe('21:05');
    expect(formatClock(MIDNIGHT, { clock: '24h' })).toBe('00:05');
    expect(formatClock(WEDNESDAY, { clock: '24h', seconds: true })).toBe('21:05:09');
  });

  it('writes 12h with a period and no padded hour', () => {
    expect(formatClock(WEDNESDAY, { clock: '12h' })).toBe('9:05 PM');
    expect(formatClock(MIDNIGHT, { clock: '12h' })).toBe('12:05 AM');
    expect(formatClock(NOON, { clock: '12h' })).toBe('12:30 PM');
    expect(formatClock(WEDNESDAY, { clock: '12h', seconds: true })).toBe('9:05:09 PM');
  });
});

describe('clockDisplayFormat', () => {
  it('names the date-fns pattern of each clock', () => {
    expect(clockDisplayFormat('24h')).toBe('HH:mm');
    expect(clockDisplayFormat('12h')).toBe('h:mm a');
  });
});
