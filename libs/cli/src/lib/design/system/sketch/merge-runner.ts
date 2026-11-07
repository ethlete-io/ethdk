import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf, readConfig } from '../../paths';
import { refreshHarnessMap } from '../harness-map';
import { oneProductOf } from './cli-args';
import { mergeSketch, MergeRefusal } from './merge';
import { recordMergeReason } from './merged-parts';
import { Sketch } from './sketch';

export type MergeRequest = { target: string; product: string; sketch: Sketch; note?: string };

export type MergeResponse = { result?: string[] | MergeRefusal; error?: string };

/** Merges the picked variant of `sketch` as the Studio merge does, on this thread: refreshes the harness map and records the note. */
export const studioMergeOf = ({ target, product: name, sketch, note }: MergeRequest): string[] | MergeRefusal => {
  const config = readConfig(target);

  if (!config) return { reason: 'no design config' };

  const product = oneProductOf({ target, config, asked: name });

  if (typeof product === 'string') return { reason: product };

  const merged = mergeSketch({ target, config, product, sketch, note });

  if (!Array.isArray(merged)) return merged;

  refreshHarnessMap({ target, product });

  if (note?.trim()) for (const part of sketch.targets) recordMergeReason({ product, part, reason: note.trim() });

  return merged;
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

/** Runs `studioMergeOf` in a worker of its own, so the server keeps answering while the merge copies, checks and writes. */
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
