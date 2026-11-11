import { statSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { resolve } from 'path';
import { Worker } from 'worker_threads';
import { forceInteractions } from './force-interactions';
import { DesignConfig } from './design-config';
import { packageFileOf } from './package-root';
import { FieldSpec } from './render-fields';
import { withinLimit } from './wait';
import {
  DEFAULT_RENDER_MODULES,
  RenderRequest,
  RenderResponse,
  RenderResult,
  renderPackagesOf,
  RenderWorkerData,
  WarmRequest,
} from './render-packages';

export const RENDER_PATH = '/__design/render';

export const FORCE_PATH = '/__design/force';

/** The header a render answer carries the worker's logged lines in, as an encoded JSON string array. */
export const SERVED_LINES_HEADER = 'x-et-lines';

/** A render asked with this header does not print what the worker logged. */
export const QUIET_HEADER = 'x-et-quiet';

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
export const RENDER_TIMEOUT_MS = 120_000;

/** A render's result with every line the worker logged while drawing it. */
export type Rendered = RenderResult & { lines?: string[] };

export const createRenderer = (options: { target: string; config: DesignConfig; timeout?: number }) => {
  const { target, config, timeout = RENDER_TIMEOUT_MS } = options;
  const workerDataOf = (): RenderWorkerData => ({
    target,
    packages: renderPackagesOf({ target, config }),
    modules: config.render?.modules ?? DEFAULT_RENDER_MODULES,
  });
  let startedWith = '';
  const pending = new Map<number, (result: Rendered) => void>();
  const sentTo = new Map<number, Worker>();
  let worker: Worker | null = null;
  let watched: Record<string, number> = {};
  let nextId = 0;

  const settleAll = (error: string) => {
    for (const settle of pending.values()) settle({ error });
    pending.clear();
    sentTo.clear();
  };
  const answer = (id: number, result: Rendered) => {
    pending.get(id)?.(result);
    pending.delete(id);
    sentTo.delete(id);
  };

  const start = () => {
    const workerData = workerDataOf();

    startedWith = JSON.stringify(workerData);

    const started = new Worker(packageFileOf(resolve(__dirname, 'render-worker.js')), { workerData });

    started.on('message', (response: RenderResponse) => {
      const { id, watched: loaded, lines, ...result } = response;

      if (started === worker) watched = { ...loaded };
      answer(id, { ...result, lines });
    });
    started.on('error', (error) =>
      settleAll(`design-explore: the render worker failed: ${error instanceof Error ? error.message : String(error)}`),
    );
    started.on('exit', () => {
      if (started === worker) worker = null;

      for (const [id, to] of sentTo)
        if (to === started) answer(id, { error: 'design-explore: the render worker exited before it answered' });
    });

    watched = {};

    return started;
  };

  const freshWorker = () => {
    if (worker && (isStale(watched) || startedWith !== JSON.stringify(workerDataOf()))) {
      void worker.terminate();
      worker = null;
    }

    worker ??= start();

    return worker;
  };

  const warm = () => freshWorker().postMessage({ warm: true } satisfies WarmRequest);

  const render = (ask: RenderAsk, options: { quiet?: boolean } = {}) => {
    const sent = freshWorker();
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
    const result = new Promise<Rendered>((settle) => pending.set(request.id, settle));

    sentTo.set(request.id, sent);
    sent.postMessage(request);

    return withinLimit(result, {
      ms: timeout,
      what: `the render worker to draw ${ask.call}`,
      announceAfterMs: 10_000,
    })
      .then((rendered) => {
        if (!options.quiet) for (const line of rendered.lines ?? []) console.warn(line);

        return rendered;
      })
      .catch((error: unknown): Rendered => {
        const message = error instanceof Error ? error.message : String(error);

        answer(request.id, { error: message });

        if (sent === worker) {
          worker = null;
          void sent.terminate();
        }

        return { error: message };
      });
  };

  const close = async () => {
    const stopped = worker;

    worker = null;
    settleAll('design-explore: the renderer closed');
    await stopped?.terminate();
  };

  return Object.assign(render, { close, warm });
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
  (render: (ask: RenderAsk, options: { quiet?: boolean }) => Promise<Rendered>) =>
  (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'POST') {
      response.statusCode = 405;
      response.end();

      return;
    }

    void readBody(request)
      .then((body) => render(JSON.parse(body) as RenderAsk, { quiet: request.headers[QUIET_HEADER] === '1' }))
      .catch((error: unknown): Rendered => ({ error: error instanceof Error ? error.message : String(error) }))
      .then(({ lines, ...result }) => {
        response.setHeader(SERVED_LINES_HEADER, encodeURIComponent(JSON.stringify(lines ?? [])));

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
