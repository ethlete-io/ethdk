import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf } from '../package-root';
import { HeldEdits, replaceHeldEdits } from './sketch/held-edits';

export type SlowRunWorkerData = { target: string; intervalMs?: number; exited?: SharedArrayBuffer };

const EXIT_WAIT_MS = 3_000;

export type SlowRunMessage = { log: string } | { held: HeldEdits } | { polled: true };

type SlowRunWorker = Pick<Worker, 'postMessage' | 'terminate' | 'unref' | 'on'>;

const startWorker = (workerData: SlowRunWorkerData): SlowRunWorker => {
  const built = packageFileOf(resolve(__dirname, 'slow-run-worker.js'));

  // Specs run this file from source, where only the `.ts` worker exists.
  return existsSync(built)
    ? new Worker(built, { workerData })
    : new Worker(resolve(__dirname, 'slow-run-worker.ts'), {
        workerData,
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

/**
 * Runs the design server's slow runner (`startSlowRunner`) in a worker, so a slow-checks poll never blocks the thread
 * that answers requests. The worker's log lines go to `log`, and the direct edits it holds replace this thread's.
 * `poll` asks for a poll now and settles when the worker's poll call returns, at once while one already runs.
 */
export const startSlowRunnerInWorker = (options: {
  target: string;
  log: (line: string) => void;
  intervalMs?: number;
  startWorker?: (workerData: SlowRunWorkerData) => SlowRunWorker;
}) => {
  const exited = new Int32Array(new SharedArrayBuffer(4));
  const worker = (options.startWorker ?? startWorker)({
    target: options.target,
    exited: exited.buffer,
    ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
  });
  const polls: (() => void)[] = [];
  const settlePolls = () => polls.splice(0).forEach((settle) => settle());

  worker.unref();
  worker.on('message', (message: SlowRunMessage) => {
    if ('log' in message) options.log(message.log);
    else if ('held' in message) replaceHeldEdits(message.held);
    else polls.shift()?.();
  });
  worker.on('error', (error: Error) => options.log(`slow checks: the worker failed: ${error.message}`));
  worker.on('exit', settlePolls);

  // A worker's own `exit` listeners (killing a harness build, removing its folder) never run when the process exits or
  // the worker is terminated, so the process waits here, a few seconds at most, for the worker to run them.
  const runWorkerExit = () => {
    worker.postMessage('exit');
    Atomics.wait(exited, 0, 0, EXIT_WAIT_MS);
  };

  process.once('exit', runWorkerExit);

  return {
    poll: () =>
      new Promise<void>((settle) => {
        polls.push(settle);
        worker.postMessage('poll');
      }),
    stop: async () => {
      process.off('exit', runWorkerExit);
      runWorkerExit();
      await worker.terminate();
      settlePolls();
    },
  };
};
