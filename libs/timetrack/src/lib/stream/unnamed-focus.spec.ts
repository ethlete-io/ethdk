import { describe, expect, it } from 'vitest';
import {
  UnnamedFocus,
  UnnamedFocusTitle,
  UnnamedFocusVerdict,
  mergeUnnamedFocus,
  mergeUnnamedTitles,
  unnamedFocusMs,
  unnamedFocusOver,
} from './unnamed-focus';

const MINUTE = 60_000;

const row = (
  appId: string,
  reason: UnnamedFocus['reason'],
  minutes: number,
  titles: UnnamedFocusTitle[] = [],
): UnnamedFocus => ({
  appId,
  reason,
  ms: minutes * MINUTE,
  titles,
});

const title = (name: string, minutes: number): UnnamedFocusTitle => ({ title: name, ms: minutes * MINUTE });

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
    const summed = mergeUnnamedFocus([
      [{ reason: 'no-name', ms: 3 * MINUTE, titles: [] }],
      [row('foot', 'no-name', 1)],
    ]);

    expect(summed).toEqual([{ reason: 'no-name', ms: 3 * MINUTE, titles: [] }, row('foot', 'no-name', 1)]);
  });

  it('sums the titles of one application over several days, longest first', () => {
    const summed = mergeUnnamedFocus([
      [row('firefox', 'no-name', 30, [title('localhost:4200', 20), title('Mail', 10)])],
      [row('firefox', 'no-name', 25, [title('Mail', 25)])],
    ]);

    expect(summed[0]?.titles).toEqual([title('Mail', 35), title('localhost:4200', 20)]);
  });

  it('leaves the titles of the day it read alone, so a second read of the same span agrees', () => {
    const day = [row('firefox', 'no-name', 10, [title('Mail', 10)])];

    mergeUnnamedFocus([day, [row('firefox', 'no-name', 5, [title('Mail', 5)])]]);

    expect(day[0]?.titles).toEqual([title('Mail', 10)]);
  });

  it('reads a span with nothing unnamed as nothing', () => {
    expect(mergeUnnamedFocus([[], []])).toEqual([]);
    expect(unnamedFocusMs([])).toBe(0);
  });

  it('adds the causes up, because every one of them is folded time', () => {
    expect(unnamedFocusMs([row('code', 'private', 30), row('foot', 'no-name', 10)])).toBe(40 * MINUTE);
  });
});

describe('mergeUnnamedTitles', () => {
  it('sums one title over several rows and orders the longest first', () => {
    expect(mergeUnnamedTitles([[title('Mail', 5), title('Chat', 9)], [title('Mail', 8)]])).toEqual([
      title('Mail', 13),
      title('Chat', 9),
    ]);
  });

  it('orders two titles of the same length by name, so the list does not shuffle between reads', () => {
    expect(mergeUnnamedTitles([[title('Mail', 5)], [title('Chat', 5)]])).toEqual([title('Chat', 5), title('Mail', 5)]);
  });

  it('reads a row with no title at all as no title', () => {
    expect(mergeUnnamedTitles([[], []])).toEqual([]);
  });
});

const judged = (span: { rows: { appId?: string; verdict: UnnamedFocusVerdict }[] }) =>
  Object.fromEntries(span.rows.map((held) => [held.appId, held.verdict]));

describe('unnamedFocusOver', () => {
  it('sums the focus of every day, and the unnamed part of it', () => {
    const span = unnamedFocusOver([
      { focusMs: 120 * MINUTE, unnamedFocus: [row('foot', 'no-name', 20)], namedApps: [] },
      { focusMs: 60 * MINUTE, unnamedFocus: [row('foot', 'no-name', 10), row('firefox', 'no-name', 5)], namedApps: [] },
    ]);

    expect(span.focusMs).toBe(180 * MINUTE);
    expect(span.unnamedMs).toBe(35 * MINUTE);
    expect(
      span.rows.map((held) => ({ appId: held.appId, reason: held.reason, ms: held.ms, titles: held.titles })),
    ).toEqual([row('foot', 'no-name', 30), row('firefox', 'no-name', 5)]);
  });

  it('reads a span of days that named everything as nothing unnamed', () => {
    const span = unnamedFocusOver([{ focusMs: 90 * MINUTE, unnamedFocus: [], namedApps: ['code'] }]);

    expect(span.unnamedMs).toBe(0);
    expect(span.rows).toEqual([]);
  });

  it('reads a span with no day at all as zero, rather than as a missing number', () => {
    expect(unnamedFocusOver([])).toEqual({ focusMs: 0, unnamedMs: 0, gapMs: 0, unknownMs: 0, rows: [] });
  });

  it('calls a stretch a gap when the same application named a checkout on another day', () => {
    const span = unnamedFocusOver([
      { focusMs: 60 * MINUTE, unnamedFocus: [], namedApps: ['code'] },
      { focusMs: 60 * MINUTE, unnamedFocus: [row('code', 'no-name', 5)], namedApps: [] },
    ]);

    expect(judged(span)).toEqual({ code: 'gap' });
    expect(span.gapMs).toBe(5 * MINUTE);
    expect(span.unknownMs).toBe(0);
  });

  it('judges an application that never named a checkout as unknown, not as a gap', () => {
    const span = unnamedFocusOver([
      { focusMs: 60 * MINUTE, unnamedFocus: [row('discord', 'no-name', 44)], namedApps: ['code'] },
    ]);

    expect(judged(span)).toEqual({ discord: 'unknown' });
    expect(span.gapMs).toBe(0);
    expect(span.unknownMs).toBe(44 * MINUTE);
  });

  it('keeps a private checkout and the app own window out of both numbers', () => {
    const span = unnamedFocusOver([
      {
        focusMs: 60 * MINUTE,
        unnamedFocus: [row('code', 'private', 15), row('timetrack', 'own-window', 20)],
        namedApps: ['code'],
      },
    ]);

    expect(judged(span)).toEqual({ code: 'on-purpose', timetrack: 'on-purpose' });
    expect(span.gapMs).toBe(0);
    expect(span.unknownMs).toBe(0);
    expect(span.unnamedMs).toBe(35 * MINUTE);
  });

  it('reads an application the user declared no work context as on purpose', () => {
    const span = unnamedFocusOver([
      { focusMs: 60 * MINUTE, unnamedFocus: [row('spotify', 'no-work-context', 25)], namedApps: ['code'] },
    ]);

    expect(judged(span)).toEqual({ spotify: 'on-purpose' });
    expect(span.unknownMs).toBe(0);
    expect(span.unnamedMs).toBe(25 * MINUTE);
  });

  it('calls a name two checkouts share a gap without asking the rest of the span', () => {
    const span = unnamedFocusOver([
      { focusMs: 60 * MINUTE, unnamedFocus: [row('code', 'ambiguous-name', 12)], namedApps: [] },
    ]);

    expect(judged(span)).toEqual({ code: 'gap' });
    expect(span.gapMs).toBe(12 * MINUTE);
  });

  it('judges a stretch no window is known for as unknown, because no application named it', () => {
    const span = unnamedFocusOver([
      { focusMs: 60 * MINUTE, unnamedFocus: [{ reason: 'no-name', ms: 4 * MINUTE, titles: [] }], namedApps: ['code'] },
    ]);

    expect(span.rows[0]?.verdict).toBe('unknown');
  });
});
