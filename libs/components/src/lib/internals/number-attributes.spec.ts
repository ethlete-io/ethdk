import { positiveIntegerAttribute, positiveNumberAttribute } from './number-attributes';

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

describe('positiveNumberAttribute', () => {
  it('keeps a positive number, fractions included', () => {
    expect(positiveNumberAttribute(0.5)).toBe(0.5);
    expect(positiveNumberAttribute('10')).toBe(10);
  });

  it('falls back to one for zero, negatives and anything unparseable', () => {
    expect(positiveNumberAttribute(0)).toBe(1);
    expect(positiveNumberAttribute('-2')).toBe(1);
    expect(positiveNumberAttribute('abc')).toBe(1);
    expect(positiveNumberAttribute(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
