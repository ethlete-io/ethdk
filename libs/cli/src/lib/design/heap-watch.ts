import { getHeapStatistics } from 'v8';
import { Worker } from 'worker_threads';

export const HEAP_STATUS_MS = 5 * 60_000;
export const HEAP_WARN_SHARE = 0.8;

export type HeapUse = { used: number; limit: number };

const MB = 1024 * 1024;

const heapUseOf = (): HeapUse => {
  const stats = getHeapStatistics();

  return { used: stats.used_heap_size, limit: stats.heap_size_limit };
};

export type WorkerHeapUse = { name: string; used: number };

const watchedWorkers = new Map<Worker, string>();

/** Adds the heap of `worker` to the status lines of `watchHeap` under `name` until it exits. Answers `worker`. */
export const watchWorkerHeap = <T extends Worker>(name: string, worker: T) => {
  watchedWorkers.set(worker, name);
  worker.on('exit', () => watchedWorkers.delete(worker));

  return worker;
};

const workerHeapUsesOf = () =>
  Promise.all(
    [...watchedWorkers].map(([worker, name]) =>
      worker.getHeapStatistics().then(
        (stats): WorkerHeapUse | null => ({ name, used: stats.used_heap_size }),
        () => null,
      ),
    ),
  ).then((uses) => uses.filter((use): use is WorkerHeapUse => use !== null));

export const workerHeapLineOf = (uses: WorkerHeapUse[]) =>
  `worker heaps ${uses.map(({ name, used }) => `${name} ${Math.round(used / MB)}`).join(', ')} MB`;

export const heapStatusLineOf = ({ used, limit }: HeapUse) =>
  `heap ${Math.round(used / MB)}/${Math.round(limit / MB)} MB`;

/**
 * Logs the heap use of this process every `everyMs`, then the heaps of the workers passed to `watchWorkerHeap`, and one
 * warning the first time the main heap passes 80 % of its limit.
 * Answers a function that stops the watch.
 */
export const watchHeap = (options: {
  log: (line: string) => void;
  heap?: () => HeapUse;
  workerHeaps?: () => Promise<WorkerHeapUse[]>;
  everyMs?: number;
}) => {
  const { log, heap = heapUseOf, workerHeaps = workerHeapUsesOf, everyMs = HEAP_STATUS_MS } = options;
  let warned = false;

  // An RxJS interval cannot unref, and a ref'd timer keeps the process alive after the server closed.
  // eslint-disable-next-line ethlete/prefer-rxjs-timer
  const timer = setInterval(() => {
    const use = heap();

    log(heapStatusLineOf(use));
    void workerHeaps().then((uses) => uses.length > 0 && log(workerHeapLineOf(uses)));

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
