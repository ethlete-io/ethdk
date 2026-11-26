import { parentPort, workerData } from 'worker_threads';
import { openJournal } from './write-journal';

const { productDir, root, holdMs, cycleMs } = workerData as {
  productDir: string;
  root: string;
  holdMs: number;
  cycleMs?: number;
};

if (cycleMs) {
  const until = Date.now() + cycleMs;

  while (Date.now() < until) openJournal({ productDir, root, label: 'merge of components/first' }).close();

  parentPort?.postMessage({ kind: 'closed', at: Date.now() });
} else {
  const journal = openJournal({ productDir, root, label: 'merge of components/first' });

  parentPort?.postMessage({ kind: 'open', at: Date.now() });
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
  journal.close();
  parentPort?.postMessage({ kind: 'closed', at: Date.now() });
}
