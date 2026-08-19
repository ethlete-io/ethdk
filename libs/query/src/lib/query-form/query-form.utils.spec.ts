import {
  transformToBooleanArray,
  transformToDateArray,
  transformToNumber,
  transformToNumberArray,
  transformToSort,
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
});
