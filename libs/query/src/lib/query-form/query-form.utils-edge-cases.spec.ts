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
  transformToTableSort,
  transformToTableSortQueryParam,
} from './query-form.utils';

const transforms = {
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
  transformToTableSort,
  transformToTableSortQueryParam,
};

describe('query form transforms at the edges', () => {
  it.each(Object.entries(transforms))('%s reads null and undefined as null', (_name, transform) => {
    expect(transform(null)).toBeNull();
    expect(transform(undefined)).toBeNull();
  });

  it('reads a non-finite number as nothing, from a param and from a value', () => {
    expect(transformToNumber('Infinity')).toBeNull();
    expect(transformToNumber('-Infinity')).toBeNull();
    expect(transformToNumber('NaN')).toBeNull();
    expect(transformToNumber(Number.NaN)).toBeNull();
    expect(transformToNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(transformToNumberArray(['1', 'Infinity', Number.NaN, '2'])).toEqual([1, 2]);
    expect(transformToNumberArray(Number.NaN)).toEqual([]);
  });

  it('reads a number with surrounding whitespace, a negative zero and an exponent', () => {
    expect(transformToNumber(' 5 ')).toBe(5);
    expect(transformToNumber('   ')).toBeNull();
    expect(transformToNumber('-0')).toBe(-0);
    expect(transformToNumber('1e3')).toBe(1000);
  });

  it('reads an invalid Date as nothing', () => {
    expect(transformToDate(new Date('nope'))).toBeNull();
    expect(transformToDateArray([new Date('nope'), '2026-09-01'])).toEqual([new Date(2026, 8, 1)]);
    expect(transformToDateArray(new Date('nope'))).toEqual([]);
  });

  it('reads an empty param as nothing for every scalar transform', () => {
    expect(transformToNumber('')).toBeNull();
    expect(transformToDate('')).toBeNull();
    expect(transformToSort('')).toBeNull();
    expect(transformToTableSort('')).toBeNull();
    expect(transformToBoolean('')).toBe(false);
    expect(transformToString('')).toBe('');
  });

  it('keeps special characters in strings and sort keys untouched', () => {
    expect(transformToString('a&b=c?d#e /ü+%20')).toBe('a&b=c?d#e /ü+%20');
    expect(transformToStringArray(['x,y', ' sp '])).toEqual(['x,y', ' sp ']);
    expect(transformToSort('näme & co:asc')).toEqual({ active: 'näme & co', direction: 'asc' });
    expect(transformToTableSort(['a b:desc'])).toEqual([{ key: 'a b', direction: 'desc' }]);
  });

  it('writes an empty table sort as an empty list, not nothing', () => {
    expect(transformToTableSortQueryParam([])).toEqual([]);
    expect(transformToTableSortQueryParam([null, { key: 'a' }, { key: 'b', direction: 'asc' }])).toEqual(['b:asc']);
  });
});
