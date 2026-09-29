import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_DAY_REVIEW_EDITS } from '../review/model';
import { writeStatement } from '../review/statements';
import { ceilToGrid, floorToGrid, nearestOnGrid } from './grid';
import { snapRowBounds } from './snap';

const MINUTE = 60_000;
const HALF_HOUR = 30 * MINUTE;
const HOUR = 60 * MINUTE;
const AT = (clock: string) => {
  const [hours, minutes] = clock.split(':').map(Number);

  return new Date(2026, 8, 11, hours ?? 0, minutes ?? 0);
};
const CLOCK = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

describe.each(['Asia/Kolkata', 'Asia/Kathmandu'])('the row grid in %s', (zone) => {
  const original = process.env['TZ'];

  beforeAll(() => {
    process.env['TZ'] = zone;
  });

  afterAll(() => {
    process.env['TZ'] = original;
  });

  it('runs in the zone it names', () => {
    expect(new Date(2026, 8, 11).getTimezoneOffset() % 60).not.toBe(0);
  });

  it('puts 30- and 60-minute grids on the local clock', () => {
    expect(CLOCK(new Date(floorToGrid(AT('09:44').getTime(), HALF_HOUR)))).toBe('09:30');
    expect(CLOCK(new Date(nearestOnGrid(AT('09:44').getTime(), HALF_HOUR)))).toBe('09:30');
    expect(CLOCK(new Date(ceilToGrid(AT('09:44').getTime(), HALF_HOUR)))).toBe('10:00');
    expect(CLOCK(new Date(floorToGrid(AT('10:40').getTime(), HOUR)))).toBe('10:00');
  });

  it('snaps a row to the local hour', () => {
    const [snapped] = snapRowBounds({
      rows: [{ from: AT('09:38'), to: AT('10:52'), durationMs: 90 * MINUTE }],
      options: { incrementMs: HOUR },
    });

    expect(snapped && `${CLOCK(snapped.from)}-${CLOCK(snapped.to)}`).toBe('09:00-11:00');
  });

  it('writes a statement on the local hour', () => {
    const edits = writeStatement({
      edits: EMPTY_DAY_REVIEW_EDITS,
      kind: 'present',
      from: AT('12:05'),
      to: AT('12:50'),
      round: { incrementMs: HOUR },
    });
    const [statement] = edits.statements;

    expect(statement && `${CLOCK(statement.from)}-${CLOCK(statement.to)}`).toBe('12:00-13:00');
  });
});
