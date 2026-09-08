import { describe, expect, it } from 'vitest';
import { formatTokenCount, totalTokens } from './tokens';

describe('formatTokenCount', () => {
  it('reads a small count as itself', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(840)).toBe('840');
  });

  it('scales to thousands and millions', () => {
    expect(formatTokenCount(1_200)).toBe('1.2 k');
    expect(formatTokenCount(1_200_000)).toBe('1.2 M');
  });

  it('drops the decimal where it says nothing', () => {
    expect(formatTokenCount(604_000_000)).toBe('604 M');
    expect(formatTokenCount(120_000)).toBe('120 k');
  });
});

describe('totalTokens', () => {
  it('leaves thinking out, because it is part of output', () => {
    expect(totalTokens({ input: 1, output: 10, cacheWrite: 100, cacheRead: 1_000, thinking: 4 })).toBe(1_111);
  });
});
