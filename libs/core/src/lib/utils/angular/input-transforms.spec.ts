import { optionalBooleanAttribute } from './input-transforms';

describe('optionalBooleanAttribute', () => {
  it('keeps null and undefined', () => {
    expect(optionalBooleanAttribute(null)).toBeNull();
    expect(optionalBooleanAttribute(undefined)).toBeUndefined();
  });

  it('reads a bare attribute as true', () => {
    expect(optionalBooleanAttribute('')).toBe(true);
  });

  it('coerces everything else like booleanAttribute', () => {
    expect(optionalBooleanAttribute(true)).toBe(true);
    expect(optionalBooleanAttribute(false)).toBe(false);
    expect(optionalBooleanAttribute('false')).toBe(false);
    expect(optionalBooleanAttribute('true')).toBe(true);
  });
});
