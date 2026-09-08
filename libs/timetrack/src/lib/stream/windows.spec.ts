import { describe, expect, it } from 'vitest';
import { clipWindows, mergeWindows, windowsContain, windowsMs } from './windows';

const AT = (minutes: number) => new Date(new Date(2026, 7, 12, 9, 0, 0).getTime() + minutes * 60_000);

const window = (from: number, to: number) => ({ from: AT(from), to: AT(to) });

describe('mergeWindows', () => {
  it('joins windows that overlap or touch', () => {
    expect(mergeWindows([window(0, 10), window(5, 20), window(20, 25)])).toEqual([window(0, 25)]);
  });

  it('keeps a gap', () => {
    expect(mergeWindows([window(20, 25), window(0, 10)])).toEqual([window(0, 10), window(20, 25)]);
  });

  it('drops an empty window', () => {
    expect(mergeWindows([window(5, 5)])).toEqual([]);
  });
});

describe('clipWindows', () => {
  it('keeps only the parts inside the bounds', () => {
    expect(clipWindows({ windows: [window(0, 60)], within: [window(10, 20), window(30, 40)] })).toEqual([
      window(10, 20),
      window(30, 40),
    ]);
  });

  it('keeps nothing when the bounds are empty', () => {
    expect(clipWindows({ windows: [window(0, 60)], within: [] })).toEqual([]);
  });
});

describe('windowsMs', () => {
  it('sums the windows', () => {
    expect(windowsMs([window(0, 10), window(20, 25)])).toBe(15 * 60_000);
  });
});

describe('windowsContain', () => {
  it('takes both edges as inside', () => {
    expect(windowsContain([window(0, 10)], AT(0))).toBe(true);
    expect(windowsContain([window(0, 10)], AT(10))).toBe(true);
    expect(windowsContain([window(0, 10)], AT(11))).toBe(false);
  });
});
