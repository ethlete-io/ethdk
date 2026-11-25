import { afterEach, describe, expect, it, vi } from 'vitest';
import { Worker } from 'worker_threads';
import { watchHeap, watchWorkerHeap } from './heap-watch';

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
      workerHeaps: () => Promise.resolve([]),
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

  it('names the heap of every watched worker after the main heap, until the worker exits', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const lines: string[] = [];
    const worker = watchWorkerHeap('render', new Worker('setInterval(() => undefined, 1000)', { eval: true }));

    await new Promise((resolve) => worker.once('online', resolve));

    const stop = watchHeap({
      log: (line) => lines.push(line),
      heap: () => ({ used: 300 * MB, limit: 4000 * MB }),
      everyMs: 1000,
    });

    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(lines).toHaveLength(2));
    await worker.terminate();
    vi.advanceTimersByTime(1000);
    await new Promise((resolve) => setImmediate(resolve));
    stop();

    expect(lines[0]).toBe('heap 300/4000 MB');
    expect(lines[1]).toMatch(/^worker heaps render \d+ MB$/);
    expect(lines.slice(2)).toEqual(['heap 300/4000 MB']);
  });
});
