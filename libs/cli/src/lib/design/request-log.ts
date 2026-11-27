import { appendFileSync, mkdirSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { dirname } from 'path';

export const REQUEST_LOG_ENV = 'DE_REQUEST_LOG';

type RequestEmitter = {
  prependListener: (
    event: 'request',
    listener: (request: IncomingMessage, response: ServerResponse) => void,
  ) => unknown;
  off: (event: 'request', listener: (request: IncomingMessage, response: ServerResponse) => void) => unknown;
};

export type RequestLogLine = {
  start: string;
  method: string;
  url: string;
  status: number;
  ms: number;
  bytes: number;
  open: number;
};

/** Appends one JSON line per finished HTTP request of `server` to `file`. Returns a function that stops logging. */
export const logRequests = (server: RequestEmitter, file: string) => {
  mkdirSync(dirname(file), { recursive: true });

  let open = 0;

  const onRequest = (request: IncomingMessage, response: ServerResponse) => {
    const started = Date.now();
    const begin = performance.now();
    const openAtStart = open;
    const writtenAtStart = request.socket.bytesWritten;

    open++;

    let logged = false;
    const finish = () => {
      if (logged) return;

      logged = true;
      open--;

      const line: RequestLogLine = {
        start: new Date(started).toISOString(),
        method: request.method ?? '',
        url: request.url ?? '',
        status: response.statusCode,
        ms: Math.round((performance.now() - begin) * 10) / 10,
        bytes: request.socket.bytesWritten - writtenAtStart,
        open: openAtStart,
      };

      try {
        appendFileSync(file, `${JSON.stringify(line)}\n`);
      } catch {
        // a full disk must not break serving
      }
    };

    response.once('finish', finish);
    response.once('close', finish);
  };

  server.prependListener('request', onRequest);

  return () => {
    server.off('request', onRequest);
  };
};
