import { describe, expect, it } from 'vitest';
import { retryAfterMsOf } from './rate-limit';

describe('retryAfterMsOf', () => {
  it('reads delta-seconds and an HTTP date, and nothing else', () => {
    const now = Date.parse('2026-09-28T10:00:00Z');

    expect(retryAfterMsOf('7', now)).toBe(7_000);
    expect(retryAfterMsOf('Mon, 28 Sep 2026 10:00:12 GMT', now)).toBe(12_000);
    expect(retryAfterMsOf('Mon, 28 Sep 2026 09:00:00 GMT', now)).toBe(0);
    expect(retryAfterMsOf('soon', now)).toBeUndefined();
    expect(retryAfterMsOf(undefined, now)).toBeUndefined();
  });
});
