import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf } from '../../package-root';
import { readConfig } from '../../design-config';
import { refreshHarnessMap } from '../harness-map';
import { oneProductOf } from './cli-args';
import { commitMergeResultSync } from './merge-commit';
import { mergeSketch, MergeRefusal } from './merge';
import { journaledMergeOf } from './merge-step';
import { recordMergeReason } from './merged-parts';
import { decideSketch, Sketch, SketchDecisionInput } from './sketch';

export type MergeRequest = {
  target: string;
  product: string;
  sketch: Sketch;
  note?: string;
  pick?: Extract<SketchDecisionInput, { kind: 'pick' }>;
};

export type MergeResponse = { result?: string[] | MergeRefusal; error?: string };

/**
 * Merges the picked variant of `sketch` as the Studio merge does, on this thread: refreshes the harness map, records the
 * note and commits the result; a commit git refuses undoes the merge and answers why. With `pick` it records that pick in the same journaled step, so a refused merge leaves
 * no pick behind.
 */
export const studioMergeOf = ({
  target,
  product: name,
  sketch: asked,
  note,
  pick,
}: MergeRequest): string[] | MergeRefusal => {
  const config = readConfig(target);

  if (!config) return { reason: 'no design config' };

  const product = oneProductOf({ target, config, asked: name });

  if (typeof product === 'string') return { reason: product };

  const sketch: Sketch = pick ? { ...asked, decision: { ...pick, decidedAt: new Date().toISOString() } } : asked;
  const variant = sketch.decision?.kind === 'pick' ? sketch.decision.variant : '';

  return journaledMergeOf({
    target,
    product,
    sketch,
    merge: () => {
      const toMerge = pick ? decideSketch({ sketch: asked, decision: pick }) : sketch;

      if (typeof toMerge === 'string') return { reason: toMerge };

      return mergeSketch({ target, config, product, sketch: toMerge, note, deferRebase: true });
    },
    finish: (before, sketchDirs) => {
      refreshHarnessMap({ target, product });

      if (note?.trim()) for (const part of sketch.targets) recordMergeReason({ product, part, reason: note.trim() });

      return commitMergeResultSync({ target, product, sketch, variant, before, sketchDirs });
    },
  });
};

const startWorker = () => {
  const built = packageFileOf(resolve(__dirname, 'merge-worker.js'));

  // Specs run this file from source, where only the `.ts` worker exists.
  return existsSync(built)
    ? new Worker(built)
    : new Worker(resolve(__dirname, 'merge-worker.ts'), {
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

/**
 * Runs `studioMergeOf` in a worker of its own, so the server keeps answering while the merge copies, checks, writes and
 * commits. On Linux a child process blocks the thread that spawns it for as long as forking the whole process takes, so
 * the server thread spawns none.
 */
export const mergeInWorker = (request: MergeRequest) =>
  new Promise<string[] | MergeRefusal>((done, fail) => {
    const worker = startWorker();
    let answered = false;

    worker.once('message', ({ result, error }: MergeResponse) => {
      answered = true;
      void worker.terminate();

      if (result) done(result);
      else fail(new Error(error ?? 'the merge worker answered nothing'));
    });
    worker.once('error', (error: Error) => fail(new Error(`the merge worker failed: ${error.message}`)));
    worker.once('exit', () => {
      if (!answered) fail(new Error('the merge worker exited before it answered'));
    });
    worker.postMessage(request);
  });
