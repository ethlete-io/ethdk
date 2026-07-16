import { de } from 'date-fns/locale';
import { formatDateValue, parseDateValue } from './date-value';

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ssxxx";
const DAY = { format: 'yyyy-MM-dd', referenceDate: new Date(2026, 0, 1) };
const ISO = { format: ISO_FORMAT, referenceDate: new Date(2026, 0, 1) };

describe('parseDateValue', () => {
  it('parses a value matching the format', () => {
    expect(parseDateValue('2026-07-16', DAY)).toEqual(new Date(2026, 6, 16));
  });

  it('parses the default ISO wire format including the offset', () => {
    expect(parseDateValue('2026-07-16T14:30:05+00:00', ISO)?.toISOString()).toBe('2026-07-16T14:30:05.000Z');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(parseDateValue('', DAY)).toBeNull();
    expect(parseDateValue('   ', DAY)).toBeNull();
  });

  it('rejects leftover characters after the format', () => {
    expect(parseDateValue('2026-07-16xx', DAY)).toBeNull();
  });

  it('rejects out-of-range date parts', () => {
    expect(parseDateValue('2026-13-45', DAY)).toBeNull();
  });

  it('rejects input matching only a prefix of the format', () => {
    expect(parseDateValue('2026-07', DAY)).toBeNull();
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseDateValue('  2026-07-16 ', DAY)).toEqual(new Date(2026, 6, 16));
  });

  it('parses localized display formats with a locale', () => {
    expect(parseDateValue('16.07.2026', { ...DAY, format: 'P', locale: de })).toEqual(new Date(2026, 6, 16));
  });
});

describe('formatDateValue', () => {
  it('formats a date with the given format', () => {
    expect(formatDateValue(new Date(2026, 6, 16), { format: 'yyyy-MM-dd' })).toBe('2026-07-16');
  });

  it('formats localized display formats with a locale', () => {
    expect(formatDateValue(new Date(2026, 6, 16), { format: 'P', locale: de })).toBe('16.07.2026');
  });

  it('returns null for invalid dates', () => {
    expect(formatDateValue(new Date(NaN), { format: 'yyyy-MM-dd' })).toBeNull();
  });

  it('round-trips through the default ISO wire format', () => {
    const date = new Date(2026, 6, 16, 14, 30, 5);
    const formatted = formatDateValue(date, { format: ISO_FORMAT });

    expect(formatted).not.toBeNull();
    expect(parseDateValue(formatted as string, ISO)).toEqual(date);
  });
});
