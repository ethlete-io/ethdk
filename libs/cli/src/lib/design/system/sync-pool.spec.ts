import { performance } from 'perf_hooks';
import { MessagePort, Worker } from 'worker_threads';
import { describe, expect, it } from 'vitest';
import { PoolWorkerData, startSyncPool } from './sync-pool';

const JOB_MS = 400;

const FAKE_WORKER = `
const { workerData } = require('worker_threads');
const { port, answered } = workerData;
const sleeper = new Int32Array(new SharedArrayBuffer(4));

port.on('message', ({ index, job }) => {
  Atomics.wait(sleeper, 0, 0, job.ms);
  port.postMessage(job.fail ? { index, error: 'job ' + job.value + ' failed' } : { index, answer: job.value * 2 });
  Atomics.add(answered, 0, 1);
  Atomics.notify(answered, 0);
});
`;

const startFake = (exited: Promise<number>[]) => (workerData: PoolWorkerData, transferList: MessagePort[]) => {
  const worker = new Worker(FAKE_WORKER, { eval: true, workerData, transferList });

  exited.push(new Promise((done) => worker.once('exit', done)));

  return worker;
};

type Job = { value: number; ms: number; fail?: boolean };

describe('startSyncPool', () => {
  it('runs the jobs in parallel, answers them in job order, and ends its workers on stop', async () => {
    const exited: Promise<number>[] = [];
    const pool = startSyncPool<Job, number>({ size: 4, start: startFake(exited) });
    const started = performance.now();

    try {
      expect(pool.run([1, 2, 3, 4].map((value) => ({ value, ms: JOB_MS })))).toEqual([2, 4, 6, 8]);
      expect(performance.now() - started).toBeLessThan(JOB_MS * 3);
      expect(pool.run([5, 6, 7, 8, 9].map((value) => ({ value, ms: 0 })))).toEqual([10, 12, 14, 16, 18]);
    } finally {
      pool.stop();
    }

    expect(await Promise.all(exited)).toHaveLength(4);
  });

  it('throws the error of a failed job', async () => {
    const exited: Promise<number>[] = [];
    const pool = startSyncPool<Job, number>({ size: 2, start: startFake(exited) });

    try {
      expect(() =>
        pool.run([
          { value: 1, ms: 0 },
          { value: 2, ms: 0, fail: true },
        ]),
      ).toThrow('job 2 failed');
    } finally {
      pool.stop();
    }

    await Promise.all(exited);
  });

  it('throws when no worker answers in time', async () => {
    const exited: Promise<number>[] = [];
    const pool = startSyncPool<Job, number>({ size: 1, start: startFake(exited), stallMs: 100 });

    try {
      expect(() => pool.run([{ value: 1, ms: 2_000 }])).toThrow('no pool worker answered in 100 ms');
    } finally {
      pool.stop();
    }

    await Promise.all(exited);
  });
});
