import { EMPTY, Observable, defer, expand, map, reduce, throwError } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';

/**
 * A Tempo Cloud API token, which is a bearer token issued by Tempo itself — a different secret from
 * the Jira API token, kept in its own keychain entry.
 */
export type TempoCredentials = {
  token: string;
};

export const TEMPO_API_BASE = 'https://api.tempo.io/4';

/**
 * The hosts a request carrying the Tempo token may reach: the global API, and the regional one
 * (`api.eu.tempo.io`) Tempo hands back as `metadata.next` for an account hosted in that region.
 */
const TEMPO_API_HOST = /^api(\.[a-z0-9-]+)?\.tempo\.io$/;

export class TempoRequestError extends Error {
  readonly status: number;
  readonly describe: string;

  constructor(options: { status: number; describe: string; message: string }) {
    super(options.message);
    this.name = 'TempoRequestError';
    this.status = options.status;
    this.describe = options.describe;
  }
}

export type TempoQuery = Record<string, string | number | boolean | undefined>;

/** The envelope every collection endpoint in Tempo v4 answers with. `next` is an absolute URL. */
export type TempoPage<T> = {
  results?: T[];
  metadata?: {
    count?: number;
    offset?: number;
    limit?: number;
    next?: string;
    previous?: string;
  };
};

export type TempoPagingOptions = {
  /** Worklogs per request. Tempo's own cap is 1000. */
  pageSize: number;
  /** A wide date range must not page forever against a rate-limited API. */
  maxPages: number;
};

export const DEFAULT_TEMPO_PAGING_OPTIONS: TempoPagingOptions = {
  pageSize: 200,
  maxPages: 20,
};

const withQuery = (url: string, query: TempoQuery | undefined) => {
  const params = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);

  return params.length === 0
    ? url
    : `${url}?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
};

const MAX_REASON_LENGTH = 300;

const reasonIn = (body: unknown) => {
  if (typeof body !== 'object' || body === null) return undefined;

  const { errors, message } = body as { errors?: unknown; message?: unknown };
  const messages = [
    ...(Array.isArray(errors) ? errors.map((error) => (error as { message?: unknown } | null)?.message) : []),
    message,
  ].filter((text): text is string => typeof text === 'string' && text.trim() !== '');

  if (messages.length === 0) return undefined;

  const reason = messages.join('; ');

  return reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH - 1)}…` : reason;
};

const statusMessageFor = (options: { status: number; describe: string }) => {
  const { status, describe } = options;

  if (status === 401 || status === 403) return `Tempo rejected the token (${status}) for ${describe}`;
  if (status === 404) return `Tempo has no ${describe}, or the token cannot see it`;
  if (status === 429) return `Tempo rate-limited the request for ${describe}`;

  return `Tempo responded ${status} for ${describe}`;
};

const messageFor = (options: { status: number; describe: string; body: unknown }) => {
  const reason = reasonIn(options.body);

  return reason ? `${statusMessageFor(options)}: ${reason}` : `${statusMessageFor(options)}.`;
};

/**
 * A `metadata.next` cursor that does not point at Tempo. The request carries the Tempo token, so the
 * page is refused rather than followed.
 */
export class TempoCursorError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Tempo offered a next page outside its own API hosts. It was not followed.`);
    this.name = 'TempoCursorError';
    this.url = url;
  }
}

/**
 * The URL one call goes to. A path is resolved against {@link TEMPO_API_BASE}; an absolute URL is a
 * `metadata.next` cursor and has to be one of Tempo's own API hosts over HTTPS.
 *
 * Tempo hands the cursor back as an absolute URL, and the call that follows it carries the bearer
 * token. A compromised or malicious Tempo could therefore name any host and be sent the token, so the
 * origin is checked before the header is attached. User info is refused with it: it is credentials in
 * a URL this app never issues.
 */
const urlFor = (path: string) => {
  if (!/^https?:\/\//.test(path)) return `${TEMPO_API_BASE}${path}`;

  const url = (() => {
    try {
      return new URL(path);
    } catch {
      throw new TempoCursorError(path);
    }
  })();

  if (url.protocol !== 'https:' || url.port || !TEMPO_API_HOST.test(url.hostname) || url.username || url.password) {
    throw new TempoCursorError(path);
  }

  return path;
};

/**
 * Issues one Tempo v4 call through the host transport. `path` may be an absolute URL, which is how a
 * `metadata.next` cursor is followed; anything else is resolved against {@link TEMPO_API_BASE}.
 */
export const tempoRequest$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  path: string;
  describe: string;
  method?: TimetrackRequestMethod;
  query?: TempoQuery;
  body?: unknown;
}): Observable<T> => {
  const { transport, credentials, path, describe } = options;

  return defer(() =>
    transport.request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(urlFor(path), options.query),
      headers: {
        authorization: `Bearer ${credentials.token}`,
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body,
    }),
  ).pipe(
    map((response) => {
      if (response.status < 200 || response.status >= 300) {
        throw new TempoRequestError({
          status: response.status,
          describe,
          message: messageFor({ status: response.status, describe, body: response.body }),
        });
      }

      return response.body;
    }),
  );
};

/**
 * Follows `metadata.next` until Tempo stops offering one, and concatenates every page's results.
 * Errors when Tempo still offers a page after `maxPages`, so a caller never reads a truncated range
 * as complete.
 */
export const tempoPaged$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: TempoCredentials;
  path: string;
  describe: string;
  query?: TempoQuery;
  options?: Partial<TempoPagingOptions>;
}): Observable<T[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_TEMPO_PAGING_OPTIONS, ...options.options };
  const page$ = (path: string, query: TempoQuery | undefined) =>
    tempoRequest$<TempoPage<T>>({
      transport: options.transport,
      credentials: options.credentials,
      path,
      describe: options.describe,
      query,
    });

  return page$(options.path, { ...options.query, limit: pageSize }).pipe(
    expand((page, index) => {
      const next = page.metadata?.next;

      if (!next) return EMPTY;
      if (index >= maxPages - 1) {
        return throwError(() => new Error(`Tempo offered more than ${maxPages} pages of ${options.describe}.`));
      }

      return page$(next, undefined);
    }),
    map((page) => page.results ?? []),
    reduce((all: T[], results) => [...all, ...results], []),
  );
};
