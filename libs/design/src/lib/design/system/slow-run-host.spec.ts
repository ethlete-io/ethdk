import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allHeldEdits, replaceHeldEdits } from './sketch/held-edits';
import { SlowRunMessage, SlowRunWorkerData, startSlowRunnerInWorker } from './slow-run-host';

const fakeWorker = (data: SlowRunWorkerData) => {
  const fake = Object.assign(new EventEmitter(), {
    postMessage: vi.fn((message: string) => {
      if (message === 'exit' && data.exited) Atomics.store(new Int32Array(data.exited), 0, 1);
    }),
    unref: vi.fn(),
    terminate: vi.fn(async () => 0),
  });

  return { fake, worker: fake as unknown as Worker };
};

describe('startSlowRunnerInWorker', () => {
  afterEach(() => replaceHeldEdits({}));

  it('starts one unreferenced worker for the target, forwards its log lines and takes the edits it holds', async () => {
    const started: SlowRunWorkerData[] = [];
    const lines: string[] = [];
    let worker: ReturnType<typeof fakeWorker>['fake'] | undefined;

    const runner = startSlowRunnerInWorker({
      target: '/repo',
      log: (line) => lines.push(line),
      intervalMs: 50,
      startWorker: (data) => {
        const made = fakeWorker(data);

        started.push(data);
        worker = made.fake;

        return made.worker;
      },
    });

    if (!worker) throw new Error('no worker started');

    worker.emit('message', { log: 'slow checks: studio components/a' } satisfies SlowRunMessage);
    worker.emit('message', {
      held: { '/repo/.ethlete/design/studio': { 'components/a': 'h1' } },
    } satisfies SlowRunMessage);
    worker.emit('error', new Error('boom'));

    expect(started).toEqual([{ target: '/repo', intervalMs: 50, exited: expect.any(SharedArrayBuffer) }]);
    expect(worker.unref).toHaveBeenCalled();
    expect(lines).toEqual(['slow checks: studio components/a', 'slow checks: the worker failed: boom']);
    expect(allHeldEdits()).toEqual({ '/repo/.ethlete/design/studio': { 'components/a': 'h1' } });
    await runner.stop();
  });

  it('settles a poll when the worker answers it, and every open poll when the worker stops', async () => {
    let worker: ReturnType<typeof fakeWorker>['fake'] | undefined;
    const runner = startSlowRunnerInWorker({
      target: '/repo',
      log: () => undefined,
      startWorker: (data) => {
        const made = fakeWorker(data);

        worker = made.fake;

        return made.worker;
      },
    });

    if (!worker) throw new Error('no worker started');
    const settled: string[] = [];

    void runner.poll().then(() => settled.push('first'));
    void runner.poll().then(() => settled.push('second'));
    worker.emit('message', { polled: true } satisfies SlowRunMessage);
    await Promise.resolve();

    expect(worker.postMessage.mock.calls).toEqual([['poll'], ['poll']]);
    expect(settled).toEqual(['first']);

    await runner.stop();

    expect(worker.postMessage).toHaveBeenLastCalledWith('exit');
    expect(worker.terminate).toHaveBeenCalled();
    expect(settled).toEqual(['first', 'second']);
  });

  it('keeps the calling thread answering while a poll blocks its worker', async () => {
    const blocking = (workerData: SlowRunWorkerData) =>
      new Worker(
        `const { parentPort, workerData } = require('worker_threads');
         parentPort.on('message', (message) => {
           if (message === 'exit') {
             const flag = new Int32Array(workerData.exited);
             Atomics.store(flag, 0, 1);
             return Atomics.notify(flag, 0);
           }
           const end = Date.now() + 1500;
           while (Date.now() < end);
           parentPort.postMessage({ polled: true });
         });`,
        { eval: true, workerData },
      );
    const runner = startSlowRunnerInWorker({ target: '/repo', log: () => undefined, startWorker: blocking });
    let last = performance.now();
    let worst = 0;
    const ticks = setInterval(() => {
      const now = performance.now();

      worst = Math.max(worst, now - last);
      last = now;
    }, 10);

    await runner.poll();
    clearInterval(ticks);
    await runner.stop();

    expect(worst).toBeLessThan(500);
  });
});
