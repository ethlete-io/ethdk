import { positiveIntegerAttribute } from './number-attributes';

describe('positiveIntegerAttribute', () => {
  it('keeps a whole positive number', () => {
    expect(positiveIntegerAttribute(5)).toBe(5);
    expect(positiveIntegerAttribute('15')).toBe(15);
  });

  it('floors zero and negatives to one', () => {
    expect(positiveIntegerAttribute(0)).toBe(1);
    expect(positiveIntegerAttribute('0')).toBe(1);
    expect(positiveIntegerAttribute(-5)).toBe(1);
  });

  it('truncates a fraction and falls back for anything unparseable', () => {
    expect(positiveIntegerAttribute(2.9)).toBe(2);
    expect(positiveIntegerAttribute(0.5)).toBe(1);
    expect(positiveIntegerAttribute('abc')).toBe(1);
    expect(positiveIntegerAttribute(Number.NaN)).toBe(1);
    expect(positiveIntegerAttribute(null)).toBe(1);
  });
});
