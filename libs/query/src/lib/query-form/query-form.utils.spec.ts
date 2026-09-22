import {
  transformToBoolean,
  transformToBooleanArray,
  transformToDate,
  transformToDateArray,
  transformToNumber,
  transformToNumberArray,
  transformToSort,
  transformToSortQueryParam,
  transformToString,
  transformToStringArray,
} from './query-form.utils';

describe('query form transforms', () => {
  it('does not coerce an empty numeric param to zero', () => {
    expect(transformToNumber('')).toBeNull();
  });

  it('restores a one-item number array from a query-param string', () => {
    expect(transformToNumberArray('5')).toEqual([5]);
  });

  it('filters invalid scalar array values', () => {
    expect(transformToDateArray('not-a-date')).toEqual([]);
    expect(transformToBooleanArray(null)).toBeNull();
  });

  it('handles empty strings consistently for scalar and array string params', () => {
    expect(transformToStringArray('')).toEqual([]);
    expect(transformToStringArray([''])).toEqual([]);
  });

  it('uses the empty sort direction when the param omits one', () => {
    expect(transformToSort('name')).toEqual({ active: 'name', direction: '' });
  });

  it('keeps only strings in string params', () => {
    expect(transformToString(5)).toBeNull();
    expect(transformToStringArray(['a', 5, '', 'b'])).toEqual(['a', 'b']);
    expect(transformToStringArray(5)).toBeNull();
  });

  it('parses numbers from strings and drops what does not parse', () => {
    expect(transformToNumber(7)).toBe(7);
    expect(transformToNumber('1.5')).toBe(1.5);
    expect(transformToNumber('abc')).toBeNull();
    expect(transformToNumber(true)).toBeNull();
    expect(transformToNumberArray(['1', 'x', '', 3])).toEqual([1, 3]);
    expect(transformToNumberArray(4)).toEqual([4]);
    expect(transformToNumberArray('abc')).toEqual([]);
    expect(transformToNumberArray({})).toBeNull();
  });

  it('reads only "true" and "1" as true', () => {
    expect(transformToBoolean(false)).toBe(false);
    expect(transformToBoolean('1')).toBe(true);
    expect(transformToBoolean('yes')).toBe(false);
    expect(transformToBoolean(1)).toBeNull();
    expect(transformToBooleanArray(['true', 'false', 1])).toEqual([true, false]);
    expect(transformToBooleanArray(true)).toEqual([true]);
    expect(transformToBooleanArray('0')).toEqual([false]);
  });

  it('reads a date-only string as local midnight and keeps a timestamp as given', () => {
    const date = new Date('2026-01-02T03:04:05.000Z');

    expect(transformToDate(date)).toBe(date);
    expect(transformToDate('2026-09-01')).toEqual(new Date(2026, 8, 1));
    expect(transformToDate('2026-09-01T10:00:00.000Z')).toEqual(new Date('2026-09-01T10:00:00.000Z'));
    expect(transformToDate(0)).toBeNull();
    expect(transformToDateArray(['2026-09-01', 'nope'])).toEqual([new Date(2026, 8, 1)]);
    expect(transformToDateArray(date)).toEqual([date]);
    expect(transformToDateArray(5)).toBeNull();
  });

  it('parses a sort param and rejects one without a field', () => {
    expect(transformToSort('name:desc')).toEqual({ active: 'name', direction: 'desc' });
    expect(transformToSort('name:up')).toEqual({ active: 'name', direction: '' });
    expect(transformToSort(':asc')).toBeNull();
    expect(transformToSort({ active: 'name', direction: 'asc' })).toBeNull();
  });

  it('writes a sort as active:direction, and nothing for a sort without a direction', () => {
    expect(transformToSortQueryParam('name:asc')).toBe('name:asc');
    expect(transformToSortQueryParam({ active: 'name', direction: 'asc' })).toBe('name:asc');
    expect(transformToSortQueryParam({ active: 'name', direction: '' })).toBeNull();
    expect(transformToSortQueryParam({ active: 'name' })).toBeNull();
    expect(transformToSortQueryParam(null)).toBeNull();
  });
});
