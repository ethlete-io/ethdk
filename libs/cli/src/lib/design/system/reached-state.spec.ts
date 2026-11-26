import { describe, expect, it } from 'vitest';
import { PixelCompare } from './part-compare';
import { reachedExpandedStateOf, reachedStateOf } from './reached-state';

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

  it('names the closest declared state with its pixel count when none matches', async () => {
    const results: Record<string, PixelCompare> = { open: diff(5036), fit: diff(456), closed: size };

    expect(
      await reachedStateOf({
        goal: 'open',
        states: ['closed', 'fit', 'open'],
        compare: async (state) => results[state] ?? null,
      }),
    ).toBe('reaches no declared state (closest fit, 456 px)');
  });

  it('reaches the goal when its app drawing shows other sample data but is strictly closest to the goal', async () => {
    const results: Record<string, PixelCompare> = {
      'comment-mode': diff(21030),
      part: diff(21212),
      'points-closed': diff(23310),
    };

    expect(
      await reachedStateOf({
        goal: 'comment-mode',
        states: ['part', 'points-closed', 'comment-mode'],
        compare: async (state) => results[state] ?? null,
      }),
    ).toBeNull();
  });

  it('still misses the goal on a tie, or when no other state has the app size to rank it against', async () => {
    const tie: Record<string, PixelCompare> = { open: diff(456), fit: diff(456) };
    const alone: Record<string, PixelCompare> = { open: diff(456), fit: size };

    for (const results of [tie, alone])
      expect(
        await reachedStateOf({
          goal: 'open',
          states: ['open', 'fit'],
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

describe('reachedExpandedStateOf', () => {
  const expected: Record<string, Record<string, string>> = {
    closed: { chip: 'false', menu: 'false' },
    'closed-focus-visible': { chip: 'false', menu: 'false' },
    open: { chip: 'true', menu: 'false' },
    plain: {},
  };
  const expectedOf = async (state: string) => expected[state] ?? {};

  it('names every other declared state whose aria-expanded controls the page shows', async () => {
    expect(
      await reachedExpandedStateOf({
        goal: 'open',
        states: ['closed', 'closed-focus-visible', 'open', 'plain'],
        expectedOf,
        after: [
          { key: 'chip', expanded: 'false' },
          { key: 'menu', expanded: 'false' },
        ],
      }),
    ).toBe('reaches state closed or closed-focus-visible instead');
  });

  it('names the closest declared state by differing controls when none matches, skipping one it cannot read', async () => {
    expect(
      await reachedExpandedStateOf({
        goal: 'open',
        states: ['broken', 'closed', 'open', 'plain'],
        expectedOf: async (state) => (state === 'broken' ? Promise.reject(new Error('no draw')) : expectedOf(state)),
        after: [
          { key: 'chip', expanded: 'true' },
          { key: 'menu', expanded: 'true' },
        ],
      }),
    ).toBe('reaches no declared state (closest open, 1 control differs)');
  });
});
