import { describe, expect, it } from 'vitest';
import { TimingLine } from './timings';
import { sinceMsOf, timingsReportOf } from './timings-command';

const NOW = Date.parse('2026-11-06T12:00:00.000Z');

const lineOf = (line: Partial<TimingLine> & { minutesAgo: number }): TimingLine => {
  const { minutesAgo, ...rest } = line;

  return {
    command: 'compare',
    args: [],
    parts: ['pages/start'],
    session: null,
    resident: false,
    start: new Date(NOW - minutesAgo * 60_000).toISOString(),
    totalMs: 1000,
    exit: 0,
    phases: [],
    queueWaitMs: 0,
    buildWaitMs: 0,
    browserStartMs: 0,
    serverStartMs: 0,
    cache: { hits: 0, misses: 0 },
    concurrentHeavy: null,
    ...rest,
  };
};

const LINES = [
  lineOf({ minutesAgo: 5, totalMs: 3000 }),
  lineOf({ minutesAgo: 10, totalMs: 4000 }),
  lineOf({
    minutesAgo: 20,
    totalMs: 9000,
    phases: [
      { name: 'compare-design-server', ms: 1000 },
      { name: 'harness-build', ms: 7000 },
    ],
  }),
  lineOf({
    minutesAgo: 30,
    command: 'sketch check',
    totalMs: 14000,
    exit: 1,
    phases: [{ name: 'render-check', ms: 12000 }],
  }),
  lineOf({ minutesAgo: 40, command: 'check', parts: [], totalMs: 50000 }),
  lineOf({ minutesAgo: 600, command: 'check', parts: [], totalMs: 90000 }),
];

const rowOf = (report: string, label: string) =>
  report.split('\n').find((line) => line.trim().startsWith(`${label} `) && line.includes('runs') === false);

describe('timingsReportOf', () => {
  it('reports the median of each command against its target, and each miss with its most expensive phase', () => {
    const report = timingsReportOf({ lines: LINES, now: NOW, sinceMs: 86_400_000 });

    expect(report).toContain('6 design runs since 2026-11-05T12:00:00.000Z');
    expect(rowOf(report, 'compare')).toMatch(/compare\s+3\s+4\.0 s\s+9\.0 s\s+5\.0 s\s+ok$/);
    expect(rowOf(report, 'sketch check')).toMatch(/sketch check\s+1\s+14\.0 s\s+14\.0 s\s+10\.0 s\s+MISS$/);
    expect(rowOf(report, 'check (full)')).toMatch(/check \(full\)\s+2\s+70\.0 s\s+90\.0 s\s+60\.0 s\s+MISS$/);
    expect(report).toContain('runs over their target: 3');
    expect(report).toContain(
      '2026-11-06T11:40:00.000Z compare pages/start 9.0 s > 5.0 s - most expensive phase harness-build 7.0 s',
    );
    expect(report).toContain(
      '2026-11-06T11:30:00.000Z sketch check pages/start 14.0 s exit 1 > 10.0 s - most expensive phase render-check 12.0 s',
    );
    expect(report).toMatch(/slowest phases[^\n]*\n[^\n]*\n\s+render-check\s+1\s+12\.0 s/);
  });

  it('keeps only the runs of --since and --command', () => {
    const lastHour = timingsReportOf({ lines: LINES, now: NOW, sinceMs: 3_600_000 });

    expect(lastHour).toContain('5 design runs since');
    expect(rowOf(lastHour, 'check (full)')).toMatch(/check \(full\)\s+1\s+50\.0 s\s+50\.0 s\s+60\.0 s\s+ok$/);

    const sketches = timingsReportOf({ lines: LINES, now: NOW, sinceMs: 86_400_000, command: 'sketch' });

    expect(sketches).toContain('1 design runs since');
    expect(rowOf(sketches, 'compare')).toBeUndefined();

    const fullChecks = timingsReportOf({ lines: LINES, now: NOW, sinceMs: 86_400_000, command: 'check (full)' });

    expect(fullChecks).toContain('2 design runs since');
  });

  it('reads --since as minutes, hours or days', () => {
    expect([sinceMsOf('30m'), sinceMsOf('1h'), sinceMsOf('2d'), sinceMsOf('1w')]).toEqual([
      1_800_000,
      3_600_000,
      172_800_000,
      null,
    ]);
  });
});
