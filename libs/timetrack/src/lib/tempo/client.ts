import { EMPTY, Observable, defer, expand, map, reduce } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';

/**
 * A Tempo Cloud API token, which is a bearer token issued by Tempo itself — a different secret from
 * the Jira API token, kept in its own keychain entry.
 */
export type TempoCredentials = {
  token: string;
};

export const TEMPO_API_BASE = 'https://api.tempo.io/4';

/** The only origin a request carrying the Tempo token may reach. */
const TEMPO_API_ORIGIN = new URL(TEMPO_API_BASE).origin;

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

const messageFor = (options: { status: number; describe: string }) => {
  const { status, describe } = options;

  if (status === 401 || status === 403) return `Tempo rejected the token (${status}) for ${describe}.`;
  if (status === 404) return `Tempo has no ${describe}, or the token cannot see it.`;
  if (status === 429) return `Tempo rate-limited the request for ${describe}.`;

  return `Tempo responded ${status} for ${describe}.`;
};

/**
 * A `metadata.next` cursor that does not point at Tempo. The request carries the Tempo token, so the
 * page is refused rather than followed.
 */
export class TempoCursorError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Tempo offered a next page outside ${TEMPO_API_ORIGIN}. It was not followed.`);
    this.name = 'TempoCursorError';
    this.url = url;
  }
}

/**
 * The URL one call goes to. A path is resolved against {@link TEMPO_API_BASE}; an absolute URL is a
 * `metadata.next` cursor and has to be Tempo's own origin over HTTPS.
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

  if (url.origin !== TEMPO_API_ORIGIN || url.username || url.password) throw new TempoCursorError(path);

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
          message: messageFor({ status: response.status, describe }),
        });
      }

      return response.body;
    }),
  );
};

/** Follows `metadata.next` until Tempo stops offering one, and concatenates every page's results. */
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
    expand((page, index) =>
      page.metadata?.next && index < maxPages - 1 ? page$(page.metadata.next, undefined) : EMPTY,
    ),
    map((page) => page.results ?? []),
    reduce((all: T[], results) => [...all, ...results], []),
  );
};
