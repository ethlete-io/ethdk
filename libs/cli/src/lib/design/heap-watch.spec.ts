import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchHeap } from './heap-watch';

const MB = 1024 * 1024;

describe('watchHeap', () => {
  afterEach(() => vi.useRealTimers());

  it('names the heap use in every status line and warns only the first time it passes 80 % of the limit', () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    let used = 1000 * MB;

    const stop = watchHeap({
      log: (line) => lines.push(line),
      heap: () => ({ used, limit: 4000 * MB }),
      everyMs: 1000,
    });

    vi.advanceTimersByTime(1000);
    used = 3300 * MB;
    vi.advanceTimersByTime(2000);
    used = 2000 * MB;
    vi.advanceTimersByTime(1000);
    used = 3600 * MB;
    vi.advanceTimersByTime(1000);
    stop();
    vi.advanceTimersByTime(5000);

    expect(lines).toEqual([
      'heap 1000/4000 MB',
      'heap 3300/4000 MB',
      'WARNING heap 3300/4000 MB is past 80 % of the limit - the server may die of "heap out of memory"; restart it',
      'heap 3300/4000 MB',
      'heap 2000/4000 MB',
      'heap 3600/4000 MB',
    ]);
  });
});
