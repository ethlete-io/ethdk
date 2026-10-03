import { toArray } from './to-array.pipe';

describe('toArray', () => {
  it('builds the indices up to the count', () => {
    expect(toArray(3)).toEqual([0, 1, 2]);
  });

  it('returns an empty array for zero and -0', () => {
    expect(toArray(0)).toEqual([]);
    expect(toArray(-0)).toEqual([]);
  });

  it('returns an empty array for a negative count instead of throwing', () => {
    expect(toArray(-1)).toEqual([]);
  });

  it('returns an empty array for NaN', () => {
    expect(toArray(NaN)).toEqual([]);
  });

  it('truncates a fractional count', () => {
    expect(toArray(2.7)).toEqual([0, 1]);
  });
});
