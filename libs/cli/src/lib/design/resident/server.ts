import { setMaxListeners } from 'events';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { performance } from 'perf_hooks';
import { interval, Subscription, tap, timer } from 'rxjs';

export const RESIDENT_IDLE_MS = 30 * 60_000;
export const RESIDENT_BEAT_MS = 10_000;
export const TOKEN_HEADER = 'x-et-design-token';

/** The environment variables of the calling CLI a request carries into the resident process. */
export const FORWARDED_ENV = [
  'ETHLETE_DESIGN_PHASES',
  'CLAUDE_CODE_SESSION_ID',
  'TMUX_PANE',
  'ETHLETE_AGENT_ROLE',
] as const;

export type ResidentRequest = {
  argv: string[];
  invocation: string;
  env: Partial<Record<(typeof FORWARDED_ENV)[number], string>>;
};

/** The run gets `signal`, which aborts when the client closes its connection before the answer ends. */
export type ResidentRun = (request: ResidentRequest & { waitedMs?: number; signal?: AbortSignal }) => Promise<number>;

export const ABORTED_EXIT = 130;

/** One line of the newline-delimited JSON answer to a run request. */
export type ResidentFrame = { o: string } | { e: string } | { beat: true } | { exit: number };

type Write = (stream: 'o' | 'e', text: string) => void;

/** Sends what the process writes to stdout and stderr to `write` until the returned function restores them. */
export const captureOutput = (write: Write) => {
  const out = process.stdout.write;
  const err = process.stderr.write;
  const into = (stream: 'o' | 'e') =>
    ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      write(stream, typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());

      const done = rest.find((arg): arg is () => void => typeof arg === 'function');

      done?.();

      return true;
    }) as typeof process.stdout.write;

  process.stdout.write = into('o');
  process.stderr.write = into('e');

  return () => {
    process.stdout.write = out;
    process.stderr.write = err;
  };
};

const withEnv = async <T>(env: ResidentRequest['env'], run: () => Promise<T>) => {
  const before = FORWARDED_ENV.map((key) => [key, process.env[key]] as const);
  const apply = (entries: readonly (readonly [string, string | undefined])[]) => {
    for (const [key, value] of entries) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  apply(FORWARDED_ENV.map((key) => [key, env[key]] as const));

  try {
    return await run();
  } finally {
    apply(before);
  }
};

const bodyOf = (request: IncomingMessage) =>
  new Promise<string>((done, fail) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => (body += chunk));
    request.once('end', () => done(body));
    request.once('error', fail);
  });

const messageOf = (error: unknown) => (error instanceof Error ? (error.stack ?? error.message) : String(error));

/**
 * Serves run requests on 127.0.0.1, one at a time, streaming what each run writes back as `ResidentFrame` lines.
 * Calls `onExit('idle')` after `idleMs` without a request and `onExit('stop')` on a stop request.
 */
export const startResidentServer = async (options: {
  token: string;
  identity: Record<string, unknown>;
  run: ResidentRun;
  onExit: (reason: 'idle' | 'stop') => void;
  idleMs?: number;
  beatMs?: number;
  capture?: typeof captureOutput;
}) => {
  const { token, identity, run, onExit, idleMs = RESIDENT_IDLE_MS, beatMs = RESIDENT_BEAT_MS } = options;
  const capture = options.capture ?? captureOutput;
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let idle: Subscription | undefined;
  const arm = () => {
    idle?.unsubscribe();
    idle = timer(idleMs)
      .pipe(tap(() => onExit('idle')))
      .subscribe();
  };

  const runRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const asked = JSON.parse(await bodyOf(request)) as ResidentRequest;
    const send = (frame: ResidentFrame) => {
      if (!response.writableEnded && !response.destroyed) response.write(`${JSON.stringify(frame)}\n`);
    };

    const gone = new AbortController();

    setMaxListeners(0, gone.signal);

    response.once('close', () => {
      if (!response.writableEnded) gone.abort();
    });
    response.writeHead(200, { 'content-type': 'application/x-ndjson' });

    if (pending > 1) send({ e: 'waiting for an earlier request to the resident design process\n' });

    const asking = performance.now();
    const beat = interval(beatMs)
      .pipe(tap(() => send({ beat: true })))
      .subscribe();
    const turn = queue.then(() =>
      gone.signal.aborted
        ? ABORTED_EXIT
        : withEnv(asked.env, async () => {
            const restore = capture((stream, text) => send(stream === 'o' ? { o: text } : { e: text }));

            try {
              return await run({ ...asked, waitedMs: performance.now() - asking, signal: gone.signal });
            } catch (error) {
              send({ e: `${messageOf(error)}\n` });

              return 1;
            } finally {
              restore();
            }
          }),
    );

    queue = turn.catch(() => undefined);

    try {
      send({ exit: await turn });
    } finally {
      beat.unsubscribe();
      response.end();
    }
  };

  const server = createServer((request, response) => {
    if (request.headers[TOKEN_HEADER] !== token) {
      response.writeHead(403).end();

      return;
    }

    if (request.method === 'GET' && request.url === '/ping') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ...identity, pending }));

      return;
    }

    if (request.method === 'POST' && request.url === '/stop') {
      response.writeHead(200).end();
      setImmediate(() => onExit('stop'));

      return;
    }

    if (request.method === 'POST' && request.url === '/run') {
      idle?.unsubscribe();
      pending++;
      void runRequest(request, response)
        .catch((error: unknown) => {
          if (!response.headersSent) response.writeHead(400);

          response.end(messageOf(error));
        })
        .finally(() => {
          pending--;

          if (pending === 0) arm();
        });

      return;
    }

    response.writeHead(404).end();
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done());
  });

  arm();

  return {
    port: (server.address() as AddressInfo).port,
    close: async () => {
      idle?.unsubscribe();

      const closed = new Promise((done) => server.close(done));

      server.closeAllConnections();
      await closed;
    },
  };
};
