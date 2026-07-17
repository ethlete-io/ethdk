import { de } from 'date-fns/locale';
import { parseDateTimeText } from './date-time-parse';

describe('parseDateTimeText', () => {
  const parse = (value: string, format = 'Pp') => parseDateTimeText(value, { format });

  const dateTime = (hours: number, minutes: number, seconds = 0) => new Date(2026, 6, 16, hours, minutes, seconds);

  it('parses strictly against the combined display format first', () => {
    expect(parse('07/16/2026, 9:30 PM')).toEqual(dateTime(21, 30));
    expect(parse('16.07.2026 14:30', 'dd.MM.yyyy HH:mm')).toEqual(dateTime(14, 30));
  });

  it('splits date and time at a separator when the strict parse fails', () => {
    expect(parse('07/16/2026 9:30 PM')).toEqual(dateTime(21, 30));
    expect(parse('07/16/2026 21:30')).toEqual(dateTime(21, 30));
    expect(parse('07/16/2026,21:30')).toEqual(dateTime(21, 30));
  });

  it('parses the time part leniently', () => {
    expect(parse('07/16/2026 930pm')).toEqual(dateTime(21, 30));
    expect(parse('07/16/2026 9')).toEqual(dateTime(9, 0));
    expect(parse('07/16/2026 9.30')).toEqual(dateTime(9, 30));
    expect(parse('07/16/2026 93015')).toEqual(dateTime(9, 30, 15));
  });

  it('commits a bare date at midnight', () => {
    expect(parse('07/16/2026')).toEqual(dateTime(0, 0));
  });

  it('rejects unparseable text', () => {
    expect(parse('not a date')).toBeNull();
    expect(parse('07/16/2026 25:00')).toBeNull();
    expect(parse('13/45/2026 9:30')).toBeNull();
    expect(parse('')).toBeNull();
  });

  it('zeroes units the entry does not carry', () => {
    // "now" (the default reference date) must not leak into the result
    expect(parse('07/16/2026 9:30')?.getSeconds()).toBe(0);
    expect(parse('07/16/2026 9:30')?.getMilliseconds()).toBe(0);
  });

  it('respects the locale for the lenient date part', () => {
    expect(parseDateTimeText('16.07.2026 21:30', { format: 'Pp', locale: de })).toEqual(dateTime(21, 30));
    expect(parseDateTimeText('16.07.2026', { format: 'Pp', locale: de })).toEqual(dateTime(0, 0));
  });
});
