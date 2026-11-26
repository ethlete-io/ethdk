import { de } from 'date-fns/locale';
import { parseDateTimeText } from './date-time-parse';
import { formatDateValue, parseDateValue } from './date-value';
import { parseTimeText } from './time-parse';
import { combineInZone, instantFromZonedFields, withZonedDay, zonedFields } from './time-zone';

const BERLIN = 'Europe/Berlin';
const NEW_YORK = 'America/New_York';
const ISO = "yyyy-MM-dd'T'HH:mm:ssxxx";

describe('date-only wire format', () => {
  it('accepts a leap day only in a leap year', () => {
    expect(parseDateValue('2024-02-29', { format: 'yyyy-MM-dd' })).toEqual(new Date(2024, 1, 29));
    expect(parseDateValue('2023-02-29', { format: 'yyyy-MM-dd' })).toBeNull();
    expect(parseDateValue('1900-02-29', { format: 'yyyy-MM-dd' })).toBeNull();
    expect(parseDateValue('2000-02-29', { format: 'yyyy-MM-dd' })).toEqual(new Date(2000, 1, 29));
  });

  it('round-trips the days the runtime clocks change on', () => {
    for (const wire of ['2026-03-29', '2026-10-25']) {
      const date = parseDateValue(wire, { format: 'yyyy-MM-dd' });

      expect(date).not.toBeNull();
      expect(date?.getHours()).toBe(0);
      expect(formatDateValue(date as Date, { format: 'yyyy-MM-dd' })).toBe(wire);
    }
  });

  it('ignores the reference date for a complete wire value', () => {
    const referenceDate = new Date(2026, 2, 29, 2, 30);

    expect(parseDateValue('2026-10-25', { format: 'yyyy-MM-dd', referenceDate })).toEqual(new Date(2026, 9, 25));
  });
});

describe('date-time wire format across daylight-saving changes', () => {
  it('reads both instants of the hour the fall-back repeats', () => {
    const first = parseDateValue('2026-10-25T02:30:00+02:00', { format: ISO });
    const second = parseDateValue('2026-10-25T02:30:00+01:00', { format: ISO });

    expect(first?.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(second?.toISOString()).toBe('2026-10-25T01:30:00.000Z');
    expect(formatDateValue(first as Date, { format: ISO })).toBe('2026-10-25T02:30:00+02:00');
    expect(formatDateValue(second as Date, { format: ISO })).toBe('2026-10-25T02:30:00+01:00');
  });

  it('reads an offset-less value in the given zone, not the runtime one', () => {
    const parsed = parseDateValue('2026-03-08 02:30', { format: 'yyyy-MM-dd HH:mm', timeZone: NEW_YORK });

    expect(parsed?.toISOString()).toBe('2026-03-08T07:30:00.000Z');
  });
});

describe('zoned wall clocks across daylight-saving changes', () => {
  it('maps every wall clock of the repeated hour back onto the same wall clock', () => {
    const instant = instantFromZonedFields(
      { year: 2026, month: 9, day: 25, hours: 2, minutes: 30, seconds: 0, milliseconds: 0 },
      BERLIN,
    );

    expect(zonedFields(instant, BERLIN)).toMatchObject({ day: 25, hours: 2, minutes: 30 });
  });

  it('keeps the time of day when moving a value onto the spring-forward day of another zone', () => {
    const instant = new Date('2026-03-01T15:00:00.000Z');
    const moved = withZonedDay(instant, { day: new Date(2026, 2, 8), timeZone: NEW_YORK });

    expect(zonedFields(moved, NEW_YORK)).toMatchObject({ month: 2, day: 8, hours: 10, minutes: 0 });
  });

  it('combines a day and a time in a zone whose day differs from the runtime one', () => {
    const combined = combineInZone({ day: new Date(2026, 11, 31), time: new Date(2026, 0, 1, 23, 45) }, NEW_YORK);

    expect(combined.toISOString()).toBe('2027-01-01T04:45:00.000Z');
  });
});

describe('typed time entry', () => {
  const referenceDate = new Date(2026, 7, 18);

  it('reads 12am as midnight and 12pm as noon', () => {
    expect(parseTimeText('12am', { format: 'HH:mm', referenceDate })).toEqual(new Date(2026, 7, 18, 0, 0));
    expect(parseTimeText('12pm', { format: 'HH:mm', referenceDate })).toEqual(new Date(2026, 7, 18, 12, 0));
    expect(parseTimeText('12:30 a.m.', { format: 'HH:mm', referenceDate })).toEqual(new Date(2026, 7, 18, 0, 30));
  });

  it('rejects hour 0 and hour 13 with a meridiem', () => {
    expect(parseTimeText('0am', { format: 'HH:mm', referenceDate })).toBeNull();
    expect(parseTimeText('13pm', { format: 'HH:mm', referenceDate })).toBeNull();
  });

  it('rejects 24:00 and minute 60', () => {
    expect(parseTimeText('24:00', { format: 'HH:mm', referenceDate })).toBeNull();
    expect(parseTimeText('2400', { format: 'HH:mm', referenceDate })).toBeNull();
    expect(parseTimeText('12:60', { format: 'HH:mm', referenceDate })).toBeNull();
  });

  it('lands on the zone day of the reference instant, not the runtime day', () => {
    const lateInBerlin = new Date('2026-08-18T23:30:00.000Z');

    const parsed = parseTimeText('9:15', { format: 'HH:mm', referenceDate: lateInBerlin, timeZone: 'Asia/Tokyo' });

    expect(parsed?.toISOString()).toBe('2026-08-19T00:15:00.000Z');
  });

  it('resolves a skipped wall clock in a zone forward to the first instant that exists', () => {
    const parsed = parseTimeText('2:30', {
      format: 'HH:mm',
      referenceDate: new Date('2026-03-08T12:00:00Z'),
      timeZone: NEW_YORK,
    });

    expect(parsed).not.toBeNull();
    expect(zonedFields(parsed as Date, NEW_YORK)).toMatchObject({ day: 8, hours: 3, minutes: 30 });
  });
});

describe('typed date-time entry', () => {
  it('rejects a leap day in a common year in both passes', () => {
    expect(parseDateTimeText('29.02.2023 10:00', { format: 'Pp', locale: de })).toBeNull();
    expect(parseDateTimeText('29.02.2024 10:00', { format: 'Pp', locale: de })).toEqual(new Date(2024, 1, 29, 10, 0));
  });

  it('reads a time on the fall-back day as its first occurrence in the runtime zone', () => {
    const parsed = parseDateTimeText('25.10.2026 02:30', { format: 'P p', locale: de });

    expect(parsed).not.toBeNull();
    expect(parsed?.getHours()).toBe(2);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('reads a date-time in a zone on that zone day', () => {
    const parsed = parseDateTimeText('31.12.2026 23:45', { format: 'P p', locale: de, timeZone: NEW_YORK });

    expect(parsed?.toISOString()).toBe('2027-01-01T04:45:00.000Z');
  });
});
