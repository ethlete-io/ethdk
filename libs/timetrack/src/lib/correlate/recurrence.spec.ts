import { describe, expect, it } from 'vitest';
import { HistoricalWorklog, detectRecurringPatterns, patternAt } from './recurrence';

/** Local-time construction on purpose: the whole feature reads weekdays and hours in local time. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 7, day, hour, minute);

const worklog = (day: number, hour: number, issueKey = 'FIP-100', minute = 0): HistoricalWorklog => ({
  issueKey,
  from: at(day, hour, minute),
  durationMs: 30 * 60_000,
});

const MONDAYS = [3, 10, 17, 24];

describe('detectRecurringPatterns', () => {
  it('finds a ticket logged on the same weekday at the same time', () => {
    const patterns = detectRecurringPatterns({ worklogs: MONDAYS.map((day) => worklog(day, 10)) });

    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.issueKey).toBe('FIP-100');
    expect(patterns[0]?.weekday).toBe(1);
    expect(patterns[0]?.occurrences).toBe(4);
  });

  it('pads the window by the tolerance either side', () => {
    const patterns = detectRecurringPatterns({
      worklogs: MONDAYS.map((day) => worklog(day, 10)),
      options: { toleranceMinutes: 15 },
    });

    expect(patterns[0]?.fromMinute).toBe(10 * 60 - 15);
    expect(patterns[0]?.toMinute).toBe(10 * 60 + 15);
  });

  it('needs enough distinct weeks before it calls anything a pattern', () => {
    expect(detectRecurringPatterns({ worklogs: MONDAYS.slice(0, 2).map((day) => worklog(day, 10)) })).toEqual([]);
  });

  it('does not count one busy Monday as several weeks', () => {
    const worklogs = [worklog(10, 10), worklog(10, 10, 'FIP-100', 20), worklog(10, 10, 'FIP-100', 40)];

    expect(detectRecurringPatterns({ worklogs })).toEqual([]);
  });

  it('rejects a pair whose start times spread across the day', () => {
    const worklogs = [worklog(3, 9), worklog(10, 13), worklog(17, 17)];

    expect(detectRecurringPatterns({ worklogs })).toEqual([]);
  });

  it('keeps weekdays apart', () => {
    const worklogs = [...MONDAYS.map((day) => worklog(day, 10)), worklog(4, 10), worklog(11, 10)];
    const patterns = detectRecurringPatterns({ worklogs });

    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.weekday).toBe(1);
  });

  it('orders the strongest pattern first', () => {
    const worklogs = [
      ...MONDAYS.map((day) => worklog(day, 10)),
      ...MONDAYS.slice(0, 3).map((day) => worklog(day, 14, 'FIP-200')),
    ];

    expect(detectRecurringPatterns({ worklogs }).map((pattern) => pattern.issueKey)).toEqual(['FIP-100', 'FIP-200']);
  });
});

describe('patternAt', () => {
  const patterns = detectRecurringPatterns({ worklogs: MONDAYS.map((day) => worklog(day, 10)) });

  it('matches a moment inside the window on the right weekday', () => {
    expect(patternAt({ patterns, at: at(31, 10, 20) })?.issueKey).toBe('FIP-100');
  });

  it('does not match the same time on another weekday', () => {
    expect(patternAt({ patterns, at: at(1, 10, 20) })).toBeUndefined();
  });

  it('does not match outside the window', () => {
    expect(patternAt({ patterns, at: at(31, 15) })).toBeUndefined();
  });

  it('prefers the pattern with the longer history when two overlap', () => {
    const overlapping = detectRecurringPatterns({
      worklogs: [
        ...MONDAYS.map((day) => worklog(day, 10)),
        ...MONDAYS.slice(0, 3).map((day) => worklog(day, 10, 'FIP-200')),
      ],
    });

    expect(patternAt({ patterns: overlapping, at: at(31, 10) })?.issueKey).toBe('FIP-100');
  });
});
