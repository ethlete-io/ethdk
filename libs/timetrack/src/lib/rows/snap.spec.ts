import { describe, expect, it } from 'vitest';
import { snapRowBounds } from './snap';

const MINUTE = 60_000;
const AT = (clock: string) => {
  const [hours, minutes] = clock.split(':').map(Number);

  return new Date(2026, 8, 11, hours ?? 0, minutes ?? 0);
};
const CLOCK = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const row = (options: { from: string; to: string; durationMinutes?: number }) => {
  const from = AT(options.from);
  const to = AT(options.to);

  return {
    from,
    to,
    durationMs:
      options.durationMinutes === undefined
        ? Math.ceil((to.getTime() - from.getTime()) / (15 * MINUTE)) * 15 * MINUTE
        : options.durationMinutes * MINUTE,
  };
};

const snap = (rows: { from: string; to: string; durationMinutes?: number }[]) =>
  snapRowBounds({ rows: rows.map(row) }).map((result) => `${CLOCK(result.from)}-${CLOCK(result.to)}`);

describe('snapRowBounds', () => {
  it('takes the start back and the end to the nearest boundary below it', () => {
    expect(snap([{ from: '09:38', to: '10:01' }])).toEqual(['09:30-10:00']);
  });

  it('takes the end up when the nearest boundary is above it', () => {
    expect(snap([{ from: '09:38', to: '10:14' }])).toEqual(['09:30-10:15']);
  });

  it('leaves a row that already sits on the boundary alone', () => {
    expect(snap([{ from: '13:00', to: '13:30' }])).toEqual(['13:00-13:30']);
  });

  it('never ends before the row has room for the time it books', () => {
    expect(snap([{ from: '09:00', to: '09:16', durationMinutes: 30 }])).toEqual(['09:00-09:30']);
  });

  it('gives a row with no time at all one increment, so it is still drawn', () => {
    expect(snap([{ from: '09:02', to: '09:03', durationMinutes: 0 }])).toEqual(['09:00-09:15']);
  });

  it('keeps the band of a row that spans a gap, rather than shrinking it to what it books', () => {
    expect(snap([{ from: '09:00', to: '12:00', durationMinutes: 120 }])).toEqual(['09:00-12:00']);
  });

  it('rounds a shared boundary down, so two touching rows stay flush', () => {
    expect(
      snap([
        { from: '09:00', to: '10:08', durationMinutes: 60 },
        { from: '10:08', to: '11:00', durationMinutes: 45 },
      ]),
    ).toEqual(['09:00-10:00', '10:00-11:00']);
  });

  it('does the same where a gap of one minute would have become an overlap of fifteen', () => {
    expect(
      snap([
        { from: '09:00', to: '10:08', durationMinutes: 60 },
        { from: '10:09', to: '11:00', durationMinutes: 45 },
      ]),
    ).toEqual(['09:00-10:00', '10:00-11:00']);
  });

  it('moves the later start up when the earlier row books all the time it was widened to', () => {
    expect(
      snap([
        { from: '09:00', to: '10:08', durationMinutes: 75 },
        { from: '10:09', to: '11:20', durationMinutes: 60 },
      ]),
    ).toEqual(['09:00-10:15', '10:15-11:15']);
  });

  it('leaves an overlap the raw clock already held', () => {
    expect(
      snap([
        { from: '09:00', to: '11:00' },
        { from: '10:00', to: '11:00' },
      ]),
    ).toEqual(['09:00-11:00', '10:00-11:00']);
  });

  it('repairs a run of rows in order', () => {
    expect(
      snap([
        { from: '09:07', to: '09:38' },
        { from: '09:38', to: '10:08' },
        { from: '10:08', to: '10:52' },
      ]),
    ).toEqual(['09:00-09:45', '09:45-10:15', '10:15-11:00']);
  });

  it('answers in the order it was given, whatever order the rows ran in', () => {
    expect(
      snap([
        { from: '11:02', to: '11:33' },
        { from: '09:07', to: '09:38' },
      ]),
    ).toEqual(['11:00-11:45', '09:00-09:45']);
  });
});
