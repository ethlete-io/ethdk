import { describe, expect, it } from 'vitest';
import { UnnamedFocus, mergeUnnamedFocus, unnamedFocusMs, unnamedFocusOver } from './unnamed-focus';

const MINUTE = 60_000;

const row = (appId: string, reason: UnnamedFocus['reason'], minutes: number): UnnamedFocus => ({
  appId,
  reason,
  ms: minutes * MINUTE,
});

describe('mergeUnnamedFocus', () => {
  it('sums one application over several days', () => {
    const summed = mergeUnnamedFocus([
      [row('foot', 'no-name', 20)],
      [row('foot', 'no-name', 15)],
      [row('foot', 'no-name', 5)],
    ]);

    expect(summed).toEqual([row('foot', 'no-name', 40)]);
  });

  it('keeps the two causes of one application apart', () => {
    const summed = mergeUnnamedFocus([[row('code', 'private', 30)], [row('code', 'no-name', 10)]]);

    expect(summed).toEqual([row('code', 'private', 30), row('code', 'no-name', 10)]);
  });

  it('orders the applications longest first, whichever day each was seen on', () => {
    const summed = mergeUnnamedFocus([
      [row('firefox', 'no-name', 5), row('foot', 'no-name', 10)],
      [row('firefox', 'no-name', 40)],
    ]);

    expect(summed.map((held) => held.appId)).toEqual(['firefox', 'foot']);
  });

  it('keeps a stretch no window is known for, rather than folding it onto an application', () => {
    const summed = mergeUnnamedFocus([[{ reason: 'no-name', ms: 3 * MINUTE }], [row('foot', 'no-name', 1)]]);

    expect(summed).toEqual([{ reason: 'no-name', ms: 3 * MINUTE }, row('foot', 'no-name', 1)]);
  });

  it('reads a span with nothing unnamed as nothing', () => {
    expect(mergeUnnamedFocus([[], []])).toEqual([]);
    expect(unnamedFocusMs([])).toBe(0);
  });

  it('adds the causes up, because every one of them is folded time', () => {
    expect(unnamedFocusMs([row('code', 'private', 30), row('foot', 'no-name', 10)])).toBe(40 * MINUTE);
  });
});

describe('unnamedFocusOver', () => {
  it('sums the focus of every day, and the unnamed part of it', () => {
    const span = unnamedFocusOver([
      { focusMs: 120 * MINUTE, unnamedFocus: [row('foot', 'no-name', 20)] },
      { focusMs: 60 * MINUTE, unnamedFocus: [row('foot', 'no-name', 10), row('firefox', 'no-name', 5)] },
    ]);

    expect(span.focusMs).toBe(180 * MINUTE);
    expect(span.unnamedMs).toBe(35 * MINUTE);
    expect(span.rows).toEqual([row('foot', 'no-name', 30), row('firefox', 'no-name', 5)]);
  });

  it('reads a span of days that named everything as nothing unnamed', () => {
    const span = unnamedFocusOver([{ focusMs: 90 * MINUTE, unnamedFocus: [] }]);

    expect(span.unnamedMs).toBe(0);
    expect(span.rows).toEqual([]);
  });

  it('reads a span with no day at all as zero, rather than as a missing number', () => {
    expect(unnamedFocusOver([])).toEqual({ focusMs: 0, unnamedMs: 0, rows: [] });
  });
});
