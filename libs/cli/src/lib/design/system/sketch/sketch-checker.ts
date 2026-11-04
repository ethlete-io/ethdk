import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf, readConfig } from '../../paths';
import { OpenSketchListing, openSketchListingOf } from './check-sketches';
import { oneProductOf } from './cli-args';

export type SketchCheckRequest = { id: number; target: string; product: string };

export type SketchCheckResponse = { id: number; result?: OpenSketchListing; error?: string };

export type CheckSketches = (options: { target: string; product: string }) => Promise<OpenSketchListing>;

/** The rule checks of `product`'s open sketches in `target`, on this thread; a string when the product does not resolve. */
export const openSketchListingAt = ({ target, product }: { target: string; product: string }) => {
  const config = readConfig(target);
  const resolved = config ? oneProductOf({ target, config, asked: product }) : 'no design config';

  return typeof resolved === 'string' ? resolved : openSketchListingOf(resolved);
};

const startWorker = () => {
  const built = packageFileOf(resolve(__dirname, 'sketch-check-worker.js'));

  // Specs run this file from source, where only the `.ts` worker exists.
  return existsSync(built)
    ? new Worker(built)
    : new Worker(resolve(__dirname, 'sketch-check-worker.ts'), {
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

/**
 * Runs the rule checks of a product's open sketches in a worker, so the server keeps answering
 * while they run. A listing asked while one for the same product runs gets that one's result.
 */
export const createSketchChecker = () => {
  const pending = new Map<number, (response: SketchCheckResponse) => void>();
  const running = new Map<string, Promise<OpenSketchListing>>();
  let worker: Worker | null = null;
  let nextId = 0;

  const failAll = (error: string) => {
    for (const [id, settle] of pending) settle({ id, error });
    pending.clear();
    worker = null;
  };

  const start = () => {
    const started = startWorker();

    started.unref();
    started.on('message', (response: SketchCheckResponse) => {
      pending.get(response.id)?.(response);
      pending.delete(response.id);
    });
    started.on('error', (error: Error) => {
      if (started === worker) failAll(`the sketch check worker failed: ${error.message}`);
    });
    started.on('exit', () => {
      if (started === worker) failAll('the sketch check worker exited before it answered');
    });

    return started;
  };

  const run = async (request: Omit<SketchCheckRequest, 'id'>) => {
    worker ??= start();

    const id = nextId++;
    const answered = new Promise<SketchCheckResponse>((settle) => pending.set(id, settle));

    worker.postMessage({ ...request, id } satisfies SketchCheckRequest);

    const { result, error } = await answered;

    if (!result) throw new Error(error ?? 'the sketch check worker answered nothing');

    return result;
  };

  const check: CheckSketches = (request) => {
    const key = `${request.target}\n${request.product}`;
    const known = running.get(key);

    if (known) return known;

    const started = run(request).finally(() => running.delete(key));

    running.set(key, started);

    return started;
  };

  const close = async () => {
    const stopping = worker;

    failAll('the sketch checker closed');
    await stopping?.terminate();
  };

  return Object.assign(check, { close });
};
