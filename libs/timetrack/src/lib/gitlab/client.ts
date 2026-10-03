/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { EMPTY, Observable, defer, expand, map, throwError, toArray } from 'rxjs';
import { TimetrackRequestMethod, TimetrackResponse, TimetrackTransport } from '../transport/ports';
import { forgeHostname } from '../forge/cli';
import { withQuery } from '../transport/query';
import { retryAfterMsOf, retryWhenRateLimited } from '../transport/rate-limit';
import { carriesCredentialsSafely, insecureHostMessage } from '../transport/secure-host';

/**
 * A personal access token for the user's own GitLab, self-hosted or not.
 *
 * `api` is what the app asks for, and the only thing it is used for now: repairing a branch and
 * starting one both write merge requests. Collection needs no token at all — it reads through `glab`,
 * which holds its own credential. The token is a keychain entry, never part of the settings document.
 */
export type GitLabCredentials = {
  host: string;
  token: string;
};

export class GitLabRequestError extends Error {
  readonly status: number;
  readonly describe: string;
  /** The wait the response's `Retry-After` asked for. */
  readonly retryAfterMs?: number;

  constructor(options: { status: number; describe: string; message: string; retryAfterMs?: number }) {
    super(options.message);
    this.name = 'GitLabRequestError';
    this.status = options.status;
    this.describe = options.describe;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export type GitLabQuery = Record<string, string | number | boolean | undefined>;

/** Trailing slashes and a missing scheme both produce a URL that answers with a redirect, not data. */
export const normalizeGitLabHost = (host: string) =>
  (/^https?:\/\//i.test(host) ? host : `https://${host}`).replace(/\/+$/, '');

/**
 * Whether a remote's host names the configured instance. Only the hostnames are compared: a remote
 * reached over ssh carries the ssh port, not the port of the web instance.
 */
export const isSameGitLabInstance = (configured: string, remoteHost: string) => {
  const hostnameOf = (host: string) => forgeHostname(host).replace(/:\d+$/, '').toLowerCase();

  return hostnameOf(configured) === hostnameOf(remoteHost);
};

const reasonOf = (body: unknown): string | undefined => {
  if (typeof body !== 'object' || body === null) return undefined;

  const { message, error } = body as { message?: unknown; error?: unknown };
  const reason = message ?? error;

  if (typeof reason === 'string') return reason;
  if (Array.isArray(reason)) return reason.join('; ');
  if (typeof reason === 'object' && reason !== null) {
    return Object.entries(reason)
      .map(([field, value]) => `${field} ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join('; ');
  }

  return undefined;
};

const statusMessageFor = (options: { status: number; describe: string }) => {
  const { status, describe } = options;

  if (status === 401) return `GitLab rejected the access token for ${describe}.`;
  if (status === 403) return `The token may not write ${describe}. That needs the \`api\` scope.`;
  if (status === 404) return `GitLab has no ${describe}, or the token cannot see it.`;
  if (status === 429) return `GitLab rate-limited the request for ${describe}.`;

  return `GitLab responded ${status} for ${describe}.`;
};

const messageFor = (options: { status: number; describe: string; body: unknown }) => {
  const reason = reasonOf(options.body);

  return reason ? `${statusMessageFor(options)} GitLab said: ${reason}` : statusMessageFor(options);
};

/** Header names arrive as the host spelled them, and GitLab's paging headers are read by name. */
const headerOf = (response: TimetrackResponse<unknown>, name: string) => {
  const found = Object.entries(response.headers).find(([key]) => key.toLowerCase() === name);

  return found?.[1]?.trim() ?? '';
};

/** Issues one GitLab REST v4 call through the host transport, and keeps the response's headers. */
export const gitlabRequest$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  path: string;
  describe: string;
  method?: TimetrackRequestMethod;
  query?: GitLabQuery;
  body?: unknown;
}): Observable<TimetrackResponse<T>> => {
  const { transport, credentials, path, describe } = options;
  const base = normalizeGitLabHost(credentials.host);

  if (!carriesCredentialsSafely(base)) {
    return throwError(
      () =>
        new GitLabRequestError({
          status: 0,
          describe,
          message: insecureHostMessage({ provider: 'GitLab', url: base }),
        }),
    );
  }

  return defer(() =>
    transport.request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${base}/api/v4${path}`, options.query),
      body: options.body,
      headers: {
        // GitLab reads a personal access token from this header. `Authorization: Bearer` is for OAuth
        // tokens only, and a PAT sent that way is rejected as invalid rather than as unauthorized.
        'private-token': credentials.token,
        accept: 'application/json',
      },
    }),
  ).pipe(
    map((response) => {
      if (response.status < 200 || response.status >= 300) {
        throw new GitLabRequestError({
          status: response.status,
          describe,
          message: messageFor({ status: response.status, describe, body: response.body }),
          retryAfterMs: retryAfterMsOf(headerOf(response, 'retry-after')),
        });
      }

      return response;
    }),
    retryWhenRateLimited((error) =>
      error instanceof GitLabRequestError && error.status === 429 ? { retryAfterMs: error.retryAfterMs } : null,
    ),
  );
};

export type GitLabPagingOptions = {
  /** Items per request. GitLab's own cap is 100. */
  pageSize: number;
  /** A wide window must not page forever against a rate-limited instance. */
  maxPages: number;
};

export const DEFAULT_GITLAB_PAGING_OPTIONS: GitLabPagingOptions = {
  pageSize: 100,
  maxPages: 20,
};

/**
 * Follows GitLab's `x-next-page` header until it comes back empty, and concatenates every page.
 *
 * The page number is a header rather than part of the body, which is why the request helper hands back
 * the whole response: a list endpoint's body is the array itself and has nowhere to carry a cursor.
 */
export const gitlabPaged$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: GitLabCredentials;
  path: string;
  describe: string;
  query?: GitLabQuery;
  options?: Partial<GitLabPagingOptions>;
}): Observable<T[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_GITLAB_PAGING_OPTIONS, ...options.options };
  const page$ = (page: number) =>
    gitlabRequest$<T[]>({
      transport: options.transport,
      credentials: options.credentials,
      path: options.path,
      describe: options.describe,
      query: { ...options.query, per_page: pageSize, page },
    });

  return page$(1).pipe(
    expand((response, index) => {
      const next = Number(headerOf(response, 'x-next-page'));

      return next > 0 && index < maxPages - 1 ? page$(next) : EMPTY;
    }),
    toArray(),
    map((responses) => responses.flatMap((response) => (Array.isArray(response.body) ? response.body : []))),
  );
};
