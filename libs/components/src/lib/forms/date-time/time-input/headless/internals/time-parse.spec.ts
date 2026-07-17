import { de } from 'date-fns/locale';
import { parseTimeText } from './time-parse';

describe('parseTimeText', () => {
  const referenceDate = new Date(2026, 6, 17, 8, 15, 30);

  const parse = (value: string, format = 'HH:mm') => parseTimeText(value, { format, referenceDate });

  const time = (hours: number, minutes: number, seconds = 0) => new Date(2026, 6, 17, hours, minutes, seconds);

  it('parses strictly against the display format first', () => {
    expect(parse('09:30')).toEqual(time(9, 30));
    expect(parse('9:30 AM', 'p')).toEqual(time(9, 30));
    expect(parse('09:30', 'p')).toEqual(time(9, 30));
  });

  it('parses bare digit runs', () => {
    expect(parse('9')).toEqual(time(9, 0));
    expect(parse('21')).toEqual(time(21, 0));
    expect(parse('930')).toEqual(time(9, 30));
    expect(parse('0930')).toEqual(time(9, 30));
    expect(parse('93015')).toEqual(time(9, 30, 15));
    expect(parse('093015')).toEqual(time(9, 30, 15));
  });

  it('parses loose separators', () => {
    expect(parse('9:5')).toEqual(time(9, 5));
    expect(parse('9.30')).toEqual(time(9, 30));
    expect(parse('9 30')).toEqual(time(9, 30));
    expect(parse('9:30:15')).toEqual(time(9, 30, 15));
  });

  it('parses meridiem suffixes', () => {
    expect(parse('930pm')).toEqual(time(21, 30));
    expect(parse('9 a.m.')).toEqual(time(9, 0));
    expect(parse('12am')).toEqual(time(0, 0));
    expect(parse('12 PM')).toEqual(time(12, 0));
    expect(parse('9:30p')).toEqual(time(21, 30));
  });

  it('accepts 24-hour entry even for a 12-hour display format', () => {
    expect(parse('21:30', 'h:mm a')).toEqual(time(21, 30));
  });

  it('rejects out-of-range parts', () => {
    expect(parse('24:00')).toBeNull();
    expect(parse('12:60')).toBeNull();
    expect(parse('93')).toBeNull();
    expect(parse('13pm')).toBeNull();
    expect(parse('0am')).toBeNull();
    expect(parse('not a time')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('zeroes units the entry does not carry', () => {
    // the reference date's own time of day must not leak into the result
    expect(parse('9:30')?.getSeconds()).toBe(0);
  });

  it('respects the locale for strict parsing', () => {
    expect(parseTimeText('09:30', { format: 'p', locale: de, referenceDate })).toEqual(time(9, 30));
  });
});
