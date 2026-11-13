import { existsSync } from 'fs';
import { resolve } from 'path';
import { fromEvent, take, tap } from 'rxjs';
import { pathToFileURL } from 'url';
import { Worker } from 'worker_threads';
import { packageFileOf } from '../../package-root';
import { readConfig } from '../../design-config';
import { ruleProblemsOf } from '../check-system';
import { Problem } from '../problem';
import { OpenSketchListing, openSketchListingOf } from './check-sketches';
import { oneProductOf } from './cli-args';

export type SketchCheckRequest = { id: number; target: string; product: string; kind: 'sketches' | 'rules' };

export type SketchCheckResponse = { id: number; result?: OpenSketchListing | Problem[]; error?: string };

export type CheckSketches = (options: { target: string; product: string }) => Promise<OpenSketchListing>;

/** The problems the rules find in a product, read from the files as they are when it runs. */
export type CheckRules = (options: { target: string; product: string; signal?: AbortSignal }) => Promise<Problem[]>;

/** The rule checks of `product`'s open sketches in `target`, on this thread; a string when the product does not resolve. */
export const openSketchListingAt = ({ target, product }: { target: string; product: string }) => {
  const config = readConfig(target);
  const resolved = config ? oneProductOf({ target, config, asked: product }) : 'no design config';

  return typeof resolved === 'string' ? resolved : openSketchListingOf(resolved);
};

/** {@link ruleProblemsOf} of `product` in `target`, on this thread; a string when the product does not resolve. */
export const ruleProblemsAt = ({ target, product }: { target: string; product: string }) => {
  const config = readConfig(target);
  const resolved = config ? oneProductOf({ target, config, asked: product }) : 'no design config';

  return typeof resolved === 'string' ? resolved : ruleProblemsOf(resolved);
};

const startWorker = (): Worker => {
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

type SketchCheckWorker = Pick<Worker, 'postMessage' | 'terminate' | 'unref' | 'on'>;

type Job = {
  id: number;
  key: string;
  request: Omit<SketchCheckRequest, 'id'>;
  waiters: Set<(response: SketchCheckResponse) => void>;
  open?: Promise<OpenSketchListing | Problem[]>;
};

/**
 * Runs the rule checks of a product's open sketches in a worker, so the server keeps answering
 * while they run. A check asked while one of the same kind for the same product is queued or runs gets that one's
 * result. A check with a `signal` stops waiting when it aborts; when no caller waits any more, the run leaves the queue,
 * or the worker running it is ended.
 */
export const createSketchChecker = (options: { startWorker?: () => SketchCheckWorker } = {}) => {
  const startOne = options.startWorker ?? startWorker;
  const queued: Job[] = [];
  const asked = new Map<string, Job>();
  let worker: SketchCheckWorker | null = null;
  let current: Job | null = null;
  let nextId = 0;

  const finish = (job: Job, response: Omit<SketchCheckResponse, 'id'>) => {
    if (asked.get(job.key) === job) asked.delete(job.key);

    for (const settle of job.waiters) settle({ ...response, id: job.id });
    job.waiters.clear();
  };

  const pump = () => {
    const next = current ? undefined : queued.shift();

    if (!next) return;

    current = next;
    worker ??= start();
    worker.postMessage({ ...next.request, id: next.id } satisfies SketchCheckRequest);
  };

  const fail = (started: SketchCheckWorker, error: string) => {
    if (started !== worker) return;

    const failed = current;

    worker = null;
    current = null;
    if (failed) finish(failed, { error });
    pump();
  };

  const start = () => {
    const started = startOne();

    started.unref();
    started.on('message', (response: SketchCheckResponse) => {
      if (started !== worker || current?.id !== response.id) return;

      const answered = current;

      current = null;
      finish(answered, response);
      pump();
    });
    started.on('error', (error: Error) => fail(started, `the sketch check worker failed: ${error.message}`));
    started.on('exit', () => fail(started, 'the sketch check worker exited before it answered'));

    return started;
  };

  const cancel = (job: Job) => {
    if (asked.get(job.key) === job) asked.delete(job.key);

    const at = queued.indexOf(job);

    if (at >= 0) {
      queued.splice(at, 1);

      return;
    }

    if (current !== job) return;

    const stopping = worker;

    worker = null;
    current = null;
    void stopping?.terminate();
    pump();
  };

  const wait = <T>(job: Job, signal?: AbortSignal) =>
    new Promise<T>((resolveResult, reject) => {
      const settle = ({ result, error }: SketchCheckResponse) => {
        aborted?.unsubscribe();

        if (result) resolveResult(result as T);
        else reject(new Error(error ?? 'the sketch check worker answered nothing'));
      };

      job.waiters.add(settle);

      const aborted =
        signal &&
        fromEvent(signal, 'abort')
          .pipe(
            take(1),
            tap(() => {
              job.waiters.delete(settle);
              reject(signal.reason);

              if (job.waiters.size === 0) cancel(job);
            }),
          )
          .subscribe();
    });

  const join = <T extends OpenSketchListing | Problem[]>(
    request: Omit<SketchCheckRequest, 'id'>,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (signal?.aborted) return Promise.reject(signal.reason);

    const key = `${request.kind}\n${request.target}\n${request.product}`;
    let job = asked.get(key);

    if (!job) {
      job = { id: nextId++, key, request, waiters: new Set() };
      asked.set(key, job);
      queued.push(job);
    }

    const waited = signal ? wait<T>(job, signal) : ((job.open ??= wait<T>(job)) as Promise<T>);

    pump();

    return waited;
  };

  const check: CheckSketches = (request) => join<OpenSketchListing>({ ...request, kind: 'sketches' });

  const rules: CheckRules = ({ signal, ...request }) => join<Problem[]>({ ...request, kind: 'rules' }, signal);

  const close = async () => {
    const stopping = worker;
    const open = [...(current ? [current] : []), ...queued];

    worker = null;
    current = null;
    queued.length = 0;
    open.forEach((job) => finish(job, { error: 'the sketch checker closed' }));
    await stopping?.terminate();
  };

  return Object.assign(check, { rules, close });
};
