import { getHeapStatistics } from 'v8';

export const HEAP_STATUS_MS = 5 * 60_000;
export const HEAP_WARN_SHARE = 0.8;

export type HeapUse = { used: number; limit: number };

const MB = 1024 * 1024;

const heapUseOf = (): HeapUse => {
  const stats = getHeapStatistics();

  return { used: stats.used_heap_size, limit: stats.heap_size_limit };
};

export const heapStatusLineOf = ({ used, limit }: HeapUse) =>
  `heap ${Math.round(used / MB)}/${Math.round(limit / MB)} MB`;

/**
 * Logs the heap use of this process every `everyMs`, and one warning the first time it passes 80 % of the heap limit.
 * Answers a function that stops the watch.
 */
export const watchHeap = (options: { log: (line: string) => void; heap?: () => HeapUse; everyMs?: number }) => {
  const { log, heap = heapUseOf, everyMs = HEAP_STATUS_MS } = options;
  let warned = false;

  // An RxJS interval cannot unref, and a ref'd timer keeps the process alive after the server closed.
  // eslint-disable-next-line ethlete/prefer-rxjs-timer
  const timer = setInterval(() => {
    const use = heap();

    log(heapStatusLineOf(use));

    if (warned || use.used < use.limit * HEAP_WARN_SHARE) return;

    warned = true;
    log(
      `WARNING ${heapStatusLineOf(use)} is past ${HEAP_WARN_SHARE * 100} % of the limit - the server may die of "heap out of memory"; restart it`,
    );
  }, everyMs);

  timer.unref();

  // eslint-disable-next-line ethlete/prefer-rxjs-timer
  return () => clearInterval(timer);
};
