import { clamp, round } from './math';

describe('clamp', () => {
  it('keeps a value inside the default 0-100 range', () => {
    expect(clamp(50)).toBe(50);
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(100);
  });

  it('respects custom bounds, inclusive', () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(25, 10, 20)).toBe(20);
    expect(clamp(10, 10, 20)).toBe(10);
    expect(clamp(20, 10, 20)).toBe(20);
  });
});

describe('round', () => {
  it('rounds to a whole number by default', () => {
    expect(round(1.4)).toBe(1);
    expect(round(1.5)).toBe(2);
  });

  it('rounds to the given precision', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2355, 3)).toBe(1.236);
  });
});
