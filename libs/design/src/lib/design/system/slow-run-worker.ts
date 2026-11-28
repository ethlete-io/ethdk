import { parentPort, workerData } from 'worker_threads';
import { readConfig } from '../design-config';
import { startSlowRunner } from './slow-run';
import { SlowRunMessage, SlowRunWorkerData } from './slow-run-host';

const { target, intervalMs, exited } = workerData as SlowRunWorkerData;
const tell = (message: SlowRunMessage) => parentPort?.postMessage(message);
const runner = startSlowRunner({
  target,
  configOf: () => readConfig(target),
  log: (log) => tell({ log }),
  onHeld: (held) => tell({ held }),
  ...(intervalMs === undefined ? {} : { intervalMs }),
});

const runExit = () => {
  runner.stop();
  process.emit('exit', 0);

  if (!exited) return;

  const flag = new Int32Array(exited);

  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
};

parentPort?.on('message', (message: 'poll' | 'exit') =>
  message === 'exit' ? runExit() : void runner.poll().then(() => tell({ polled: true })),
);
