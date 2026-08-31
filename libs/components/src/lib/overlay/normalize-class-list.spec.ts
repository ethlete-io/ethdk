import { normalizeClassList } from './normalize-class-list';

describe('normalizeClassList', () => {
  it('returns an empty array for undefined', () => {
    expect(normalizeClassList(undefined)).toEqual([]);
  });

  it('wraps a single class string in an array', () => {
    expect(normalizeClassList('foo')).toEqual(['foo']);
  });

  it('returns the array unchanged', () => {
    expect(normalizeClassList(['foo', 'bar'])).toEqual(['foo', 'bar']);
  });

  it('returns an empty array for an empty string', () => {
    expect(normalizeClassList('')).toEqual([]);
  });
});
