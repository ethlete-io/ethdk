import { describe, expect, it } from 'vitest';
import { coverageAsForeignTime, tempoDayCoverageOf } from './coverage';

const HOUR = 60 * 60_000;
const observedAt = new Date(2026, 7, 11, 18, 0);

describe('tempoDayCoverageOf', () => {
  it('totals every worklog on one issue into one entry', () => {
    const coverage = tempoDayCoverageOf({
      day: '2026-08-11',
      observedAt,
      foreign: [
        { issueKey: 'FIP-1', durationMs: HOUR },
        { issueKey: 'FIP-1', durationMs: 2 * HOUR },
        { issueKey: 'FIP-2', durationMs: HOUR },
      ],
    });

    expect(coverage.issues).toEqual([
      { issueKey: 'FIP-1', coveredMs: 3 * HOUR },
      { issueKey: 'FIP-2', coveredMs: HOUR },
    ]);
    expect(coverage.day).toBe('2026-08-11');
    expect(coverage.observedAt).toEqual(observedAt);
  });

  it('records a day Tempo holds nothing for, so the reader can tell it from a day never previewed', () => {
    expect(tempoDayCoverageOf({ day: '2026-08-11', observedAt, foreign: [] }).issues).toEqual([]);
  });
});

describe('coverageAsForeignTime', () => {
  it('names nothing for a day no preview has covered', () => {
    expect(coverageAsForeignTime(null)).toEqual([]);
  });

  it('gives the subtraction one entry per issue', () => {
    const coverage = tempoDayCoverageOf({
      day: '2026-08-11',
      observedAt,
      foreign: [{ issueKey: 'FIP-1', durationMs: HOUR }],
    });

    expect(coverageAsForeignTime(coverage)).toEqual([{ issueKey: 'FIP-1', durationMs: HOUR }]);
  });
});
