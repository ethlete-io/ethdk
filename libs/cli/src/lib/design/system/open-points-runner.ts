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
import { allHeldEdits, HeldEdits } from './sketch/held-edits';
import { openDirectEditPartsOf } from './sketch/merged-parts';

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

export type WorkerRequest = ({ request: OpenPointsRequest } | { inputs: ResolvedProduct }) & { held: HeldEdits };

/** The build-ready inputs of every part of a product as data, so they cross from the worker. */
export type BuildReadyData = { points: PartOpenPoints[]; problems: Record<string, Problem[]> };

/** The open points of every part of a product, or of one part with its ready state; `findings` are the part's drawn findings. */
export const openPointsOf = ({ product, part, findings }: OpenPointsRequest): OpenPointsAnswer => {
  const cached = cachedOpenPointsOf(product);

  if (part === null) return { parts: cached.points };

  const points = partPointsOf(
    findings ? readOpenPoints(product, { ...findings, sketchProblems: true }) : cached.points,
    part,
  );
  const located = readyPartOf({ product, part });
  const { inputs } = cached;

  return {
    part,
    hash: typeof located === 'string' ? null : located.hash,
    ready: readyMarkOf({ product, part }),
    directEdit: openDirectEditPartsOf(product).includes(part),
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

type Waiting = { done: (answer: unknown) => void; fail: (error: Error) => void };
type Running = { worker: Worker; pending: Map<number, Waiting> };

const workers = new Map<string, Running>();
const live = new Set<Worker>();
let nextId = 0;

const failAll = ({ name, running }: { name: string; running: Running }, error: Error) => {
  if (workers.get(name) === running) workers.delete(name);

  for (const { fail } of running.pending.values()) fail(error);

  running.pending.clear();
};

const runningWorkerOf = (name: string) => {
  const known = workers.get(name);

  if (known) return known;

  const running: Running = { worker: startWorker(), pending: new Map() };
  const { worker, pending } = running;

  worker.on('message', ({ id, result, error }: Message) => {
    const waiting = pending.get(id);

    pending.delete(id);

    if (pending.size === 0) worker.unref();
    if (!waiting) return;
    if (error === undefined) waiting.done(result);
    else waiting.fail(new Error(error));
  });
  worker.on('error', (error: Error) =>
    failAll({ name, running }, new Error(`the open-points worker failed: ${error.message}`)),
  );
  worker.on('exit', () => {
    live.delete(worker);
    failAll({ name, running }, new Error('the open-points worker exited before it answered'));
  });
  live.add(worker);
  workers.set(name, running);

  return running;
};

const askWorker = (product: ResolvedProduct, message: Omit<WorkerRequest, 'held'>) =>
  new Promise<unknown>((done, fail) => {
    const id = nextId++;
    const { worker, pending } = runningWorkerOf(product.name);

    pending.set(id, { done, fail });
    worker.ref();
    worker.postMessage({ id, held: allHeldEdits(), ...message });
  });

/**
 * Runs `openPointsOf` in a long-lived worker per product name, so the server keeps answering while the rules read the
 * product and Tailwind sorts its classes, and one product's run never waits for another's. Each worker keeps its own
 * open-points cache.
 */
export const openPointsInWorker = async (request: OpenPointsRequest) => {
  const answer = await askWorker(request.product, { request });

  if (!answer) throw new Error('the open-points worker answered nothing');

  return answer as OpenPointsAnswer;
};

/** Runs `buildReadyDataOf` in the open-points worker, off the thread that answers requests. */
export const buildReadyDataInWorker = async (product: ResolvedProduct) =>
  (await askWorker(product, { inputs: product })) as BuildReadyData;

/** Fills the open-points cache of each product in its worker, so the first request for one finds the work done or under way. */
export const warmOpenPointsOf = (products: ResolvedProduct[], log: (line: string) => void) =>
  Promise.all(
    products.map((product) =>
      openPointsInWorker({ product, part: null }).catch((error: unknown) =>
        log(
          `the open points of ${product.name} were not warmed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ),
    ),
  );

/** How many open-points workers run, each with the variant pool it may hold. */
export const liveOpenPointsWorkers = () => live.size;

/** Ends every open-points worker and its variant pool; a later request starts a new one. */
export const stopOpenPointsWorkers = async () => {
  const stopping = [...workers.values()];

  workers.clear();
  await Promise.all(stopping.map(({ worker }) => worker.terminate()));
};
