import { describe, expect, it } from 'vitest';
import { PixelCompare } from './part-compare';
import { reachedStateOf } from './reached-state';

const diff = (pixels: number): PixelCompare => ({ kind: 'diff', pixels, diff: Buffer.alloc(0) });
const size: PixelCompare = {
  kind: 'size',
  design: { width: 1, height: 1 },
  app: { width: 2, height: 2 },
  diff: Buffer.alloc(0),
};

describe('reachedStateOf', () => {
  it('names another declared state the app drawing matches exactly', async () => {
    const results: Record<string, PixelCompare> = { open: diff(456), fit: { kind: 'ok' }, closed: diff(3) };

    expect(
      await reachedStateOf({
        goal: 'open',
        states: ['closed', 'fit', 'open'],
        compare: async (state) => results[state] ?? null,
      }),
    ).toBe('reaches state fit instead');
  });

  it('names the closest declared state with its pixel count when none matches, the goal included', async () => {
    const results: Record<string, PixelCompare> = { open: diff(456), fit: diff(5036), closed: size };

    expect(
      await reachedStateOf({
        goal: 'open',
        states: ['closed', 'fit', 'open'],
        compare: async (state) => results[state] ?? null,
      }),
    ).toBe('reaches no declared state (closest open, 456 px)');
  });

  it('skips a state it cannot draw and names no closest state when no drawing has the app size', async () => {
    expect(
      await reachedStateOf({
        goal: 'open',
        states: ['closed', 'open'],
        compare: async (state) => (state === 'closed' ? Promise.reject(new Error('no draw')) : size),
      }),
    ).toBe('reaches no declared state');
  });
});
