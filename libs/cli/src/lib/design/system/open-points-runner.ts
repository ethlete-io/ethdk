import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf } from '../package-root';
import { DrawnFindings } from './drawn-open-points';
import { cachedOpenPointsOf } from './open-points-cache';
import { OpenPoint, PartOpenPoints } from './open-points';
import { buildReadyOf } from './part-build-ready';
import { readyMarkOf, readyPartOf } from './part-ready';
import { partPointsOf, readOpenPoints } from './read-open-points';
import { Problem } from './problem';
import { partKeyOf, ResolvedProduct } from './resolve-product';
import { changedOutsideSketchOf } from './sketch/merged-parts';

export type OpenPointsRequest = {
  product: ResolvedProduct;
  part: string | null;
  findings?: Partial<DrawnFindings>;
};

export type PartOpenPointsAnswer = {
  part: string;
  hash: string | null;
  ready: ReturnType<typeof readyMarkOf>;
  directEdit: boolean;
  buildReady: ReturnType<typeof buildReadyOf>;
  points: OpenPoint[];
};

export type OpenPointsAnswer = { parts: PartOpenPoints[] } | PartOpenPointsAnswer;

type Message = { id: number; result?: unknown; error?: string };

export type WorkerRequest = { request: OpenPointsRequest } | { inputs: ResolvedProduct };

/** The build-ready inputs of every part of a product as data, so they cross from the worker. */
export type BuildReadyData = { points: PartOpenPoints[]; problems: Record<string, Problem[]> };

/** The open points of every part of a product, or of one part with its ready state; `findings` are the part's drawn findings. */
export const openPointsOf = ({ product, part, findings }: OpenPointsRequest): OpenPointsAnswer => {
  const cached = cachedOpenPointsOf(product);

  if (part === null) return { parts: cached.points };

  const points = partPointsOf(findings ? readOpenPoints(product, findings) : cached.points, part);
  const located = readyPartOf({ product, part });
  const { inputs } = cached;

  return {
    part,
    hash: typeof located === 'string' ? null : located.hash,
    ready: readyMarkOf({ product, part }),
    directEdit: changedOutsideSketchOf(product).includes(part),
    buildReady: buildReadyOf({
      product,
      part,
      inputs: { ...inputs, pointsOf: (key) => (key === part ? points : inputs.pointsOf(key)) },
    }),
    points,
  };
};

/** The open points and rule problems of every part of a product, from the open-points cache. */
export const buildReadyDataOf = (product: ResolvedProduct): BuildReadyData => {
  const { points, inputs } = cachedOpenPointsOf(product);

  return {
    points,
    problems: Object.fromEntries(product.parts.map(partKeyOf).map((part) => [part, inputs.problemsOf(part)])),
  };
};

const startWorker = () => {
  const built = packageFileOf(resolve(__dirname, 'open-points-worker.js'));

  // Specs run this file from source, where only the `.ts` worker exists.
  return existsSync(built)
    ? new Worker(built)
    : new Worker(resolve(__dirname, 'open-points-worker.ts'), {
        execArgv: [
          '--import',
          pathToFileURL(resolve(require.resolve('jiti/package.json'), '../lib/jiti-register.mjs')).href,
        ],
      });
};

const pending = new Map<number, { done: (answer: unknown) => void; fail: (error: Error) => void }>();
let worker: Worker | null = null;
let nextId = 0;

const failAll = (failed: Worker, error: Error) => {
  if (worker === failed) worker = null;

  for (const { fail } of pending.values()) fail(error);

  pending.clear();
};

const runningWorker = () => {
  if (worker) return worker;

  const started = startWorker();

  started.on('message', ({ id, result, error }: Message) => {
    const waiting = pending.get(id);

    pending.delete(id);

    if (pending.size === 0) started.unref();
    if (!waiting) return;
    if (error === undefined) waiting.done(result);
    else waiting.fail(new Error(error));
  });
  started.on('error', (error: Error) => failAll(started, new Error(`the open-points worker failed: ${error.message}`)));
  started.on('exit', () => failAll(started, new Error('the open-points worker exited before it answered')));
  worker = started;

  return started;
};

const askWorker = (message: WorkerRequest) =>
  new Promise<unknown>((done, fail) => {
    const id = nextId++;
    const running = runningWorker();

    pending.set(id, { done, fail });
    running.ref();
    running.postMessage({ id, ...message });
  });

/**
 * Runs `openPointsOf` in one long-lived worker, so the server keeps answering while the rules read the product and
 * Tailwind sorts its classes. The worker keeps its own open-points cache.
 */
export const openPointsInWorker = async (request: OpenPointsRequest) => {
  const answer = await askWorker({ request });

  if (!answer) throw new Error('the open-points worker answered nothing');

  return answer as OpenPointsAnswer;
};

/** Runs `buildReadyDataOf` in the open-points worker, off the thread that answers requests. */
export const buildReadyDataInWorker = async (product: ResolvedProduct) =>
  (await askWorker({ inputs: product })) as BuildReadyData;
