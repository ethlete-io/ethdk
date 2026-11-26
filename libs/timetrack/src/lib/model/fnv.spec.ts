import { describe, expect, it } from 'vitest';
import { fnv1aHash } from './fnv';

describe('fnv1aHash', () => {
  it('matches the published FNV-1a test vectors', () => {
    expect(fnv1aHash('')).toBe(0x811c9dc5);
    expect(fnv1aHash('a')).toBe(0xe40c292c);
    expect(fnv1aHash('foobar')).toBe(0xbf9cf968);
  });

  it('is always an unsigned 32-bit integer', () => {
    for (const text of ['x', 'ü', '😀', 'a'.repeat(10_000)]) {
      const hash = fnv1aHash(text);

      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    }
  });
});
