import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSavedDays$ } from './day-rows';

describe('sendSavedDays$', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const run = (options: { openDay?: string; fail?: string } = {}) => {
    const saved$ = new Subject<string>();
    const sent: string[] = [];
    const subscription = sendSavedDays$({
      saved$,
      openDay: () => options.openDay ?? '2026-11-19',
      send$: (day) => {
        sent.push(day);

        return day === options.fail ? throwError(() => new Error('host down')) : of(undefined);
      },
      debounceMs: 100,
    }).subscribe();

    return { saved$, sent, subscription };
  };

  it('sends a day saved off screen once its saves settle, without reopening it', () => {
    const { saved$, sent, subscription } = run();

    saved$.next('2026-11-17');
    saved$.next('2026-11-17');
    saved$.next('2026-11-18');
    vi.advanceTimersByTime(99);

    expect(sent).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(sent).toEqual(['2026-11-17', '2026-11-18']);
    subscription.unsubscribe();
  });

  it('leaves the day on screen to the review, which sends it itself', () => {
    const { saved$, sent, subscription } = run({ openDay: '2026-11-17' });

    saved$.next('2026-11-17');
    vi.advanceTimersByTime(100);

    expect(sent).toEqual([]);
    subscription.unsubscribe();
  });

  it('keeps sending after a send fails', () => {
    const { saved$, sent, subscription } = run({ fail: '2026-11-16' });

    saved$.next('2026-11-16');
    vi.advanceTimersByTime(100);
    saved$.next('2026-11-16');
    saved$.next('2026-11-17');
    vi.advanceTimersByTime(100);

    expect(sent).toEqual(['2026-11-16', '2026-11-16', '2026-11-17']);
    subscription.unsubscribe();
  });
});
