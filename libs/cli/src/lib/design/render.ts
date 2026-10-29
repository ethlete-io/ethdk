import { statSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';
import { Worker } from 'worker_threads';
import { forceInteractions } from './force-interactions';
import { DesignConfig, packageFileOf } from './paths';
import { FieldSpec } from './render-fields';
import {
  DEFAULT_RENDER_MODULES,
  RenderRequest,
  RenderResponse,
  RenderResult,
  RenderWorkerData,
} from './render-packages';

export const RENDER_PATH = '/__design/render';

export const FORCE_PATH = '/__design/force';

const mtimeOf = (path: string) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return -1;
  }
};

/** Whether a file the worker loaded changed since it loaded it, so the worker holds stale code. */
export const isStale = (watched: Record<string, number>, mtime: (path: string) => number = mtimeOf) =>
  Object.entries(watched).some(([path, loaded]) => mtime(path) !== loaded);

export type RenderAsk = {
  call: string;
  product?: string;
  template: string;
  imports: string[];
  fields?: Record<string, FieldSpec>;
};

/**
 * Renders Angular templates in a worker that loads the target checkout's own packages. The worker
 * is replaced on the first request after a package it loaded was rebuilt.
 */
export const createRenderer = (options: { target: string; config: DesignConfig }) => {
  const { target, config } = options;
  const workerDataOf = (): RenderWorkerData => ({
    target,
    packages: config.render?.packages ?? {},
    modules: config.render?.modules ?? DEFAULT_RENDER_MODULES,
  });
  let startedWith = '';
  const pending = new Map<number, (result: RenderResult) => void>();
  let worker: Worker | null = null;
  let watched: Record<string, number> = {};
  let nextId = 0;

  const settleAll = (error: string) => {
    for (const settle of pending.values()) settle({ error });
    pending.clear();
  };

  const start = () => {
    const workerData = workerDataOf();

    startedWith = JSON.stringify(workerData);

    const started = new Worker(packageFileOf(resolve(__dirname, 'render-worker.js')), { workerData });

    started.on('message', (response: RenderResponse) => {
      const { id, watched: loaded, ...result } = response;

      if (started === worker) watched = { ...loaded };
      pending.get(id)?.(result);
      pending.delete(id);
    });
    started.on('error', (error) =>
      settleAll(`design-explore: the render worker failed: ${error instanceof Error ? error.message : String(error)}`),
    );
    started.on('exit', () => {
      if (started === worker) worker = null;
    });

    watched = {};

    return started;
  };

  return (ask: RenderAsk) => {
    if (worker && (isStale(watched) || startedWith !== JSON.stringify(workerDataOf()))) {
      void worker.terminate();
      worker = null;
    }

    worker ??= start();

    const providers = ask.product
      ? config.products?.[ask.product]?.providers
      : config.projects?.[ask.call.split('/')[0] ?? '']?.providers;
    const request: RenderRequest = {
      id: nextId++,
      template: ask.template,
      imports: ask.imports,
      fields: ask.fields ?? null,
      providers: providers ? resolve(target, providers) : null,
    };
    const result = new Promise<RenderResult>((settle) => pending.set(request.id, settle));

    worker.postMessage(request);

    return result;
  };
};

const readBody = (request: IncomingMessage) =>
  new Promise<string>((settle, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => settle(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

/**
 * Answers `POST /__design/render` with the rendered markup and styles, the styles rewritten so a frame
 * can force their interactions, or a 500 with the error.
 */
export const renderMiddleware =
  (render: (ask: RenderAsk) => Promise<RenderResult>) => (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end();

      return;
    }

    void readBody(request)
      .then((body) => render(JSON.parse(body) as RenderAsk))
      .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }))
      .then((result) => {
        if ('error' in result) {
          response.statusCode = 500;
          response.setHeader('content-type', 'text/plain; charset=utf-8');
          response.end(result.error);

          return;
        }

        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ...result, styles: result.styles.map(forceInteractions) }));
      });
  };

/** Answers `POST /__design/force` with the posted CSS, rewritten so a frame can force its interactions. */
export const forceMiddleware = (request: IncomingMessage, response: ServerResponse) => {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.end();

    return;
  }

  void readBody(request).then(
    (css) => {
      response.setHeader('content-type', 'text/css; charset=utf-8');
      response.end(forceInteractions(css));
    },
    () => {
      response.statusCode = 400;
      response.end();
    },
  );
};
