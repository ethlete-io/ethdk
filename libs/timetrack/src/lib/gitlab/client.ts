/* eslint-disable @typescript-eslint/naming-convention -- GitLab's REST v4 wire format is snake_case. */
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { TimetrackRequestMethod, TimetrackResponse, TimetrackTransport } from '../transport/ports';

/**
 * A personal access token for the user's own GitLab, self-hosted or not.
 *
 * `api` is what the app asks for, because repairing a branch and starting one both write merge
 * requests. Collection alone needs **both** `read_api` and `read_user`: `/events` is documented as
 * `read_user` or `api`, and `read_api` does not include it. The token is a keychain entry, never part
 * of the settings document.
 */
export type GitLabCredentials = {
  host: string;
  token: string;
};

export class GitLabRequestError extends Error {
  readonly status: number;
  readonly describe: string;

  constructor(options: { status: number; describe: string; message: string }) {
    super(options.message);
    this.name = 'GitLabRequestError';
    this.status = options.status;
    this.describe = options.describe;
  }
}

export type GitLabQuery = Record<string, string | number | boolean | undefined>;

/** Trailing slashes and a missing scheme both produce a URL that answers with a redirect, not data. */
export const normalizeGitLabHost = (host: string) =>
  (/^https?:\/\//.test(host) ? host : `https://${host}`).replace(/\/+$/, '');

const withQuery = (url: string, query: GitLabQuery | undefined) => {
  const params = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);

  return params.length === 0
    ? url
    : `${url}?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
};

/**
 * The scope GitLab documents for a path, so a 403 names the one that is missing.
 *
 * `/events` is the exception the whole distinction exists for: it is documented as `read_user` or
 * `api`, and `read_api` does not cover it. A token made from the `read_api` instruction this app used
 * to give therefore reads every merge request and refuses the activity feed.
 */
const scopeFor = (path: string) => (path === '/events' ? 'read_user' : 'read_api');

const messageFor = (options: { status: number; describe: string; path: string }) => {
  const { status, describe, path } = options;

  if (status === 401) return `GitLab rejected the access token for ${describe}.`;
  if (status === 403) return `The token may not read ${describe}. That needs the \`${scopeFor(path)}\` scope.`;
  if (status === 404) return `GitLab has no ${describe}, or the token cannot see it.`;
  if (status === 429) return `GitLab rate-limited the request for ${describe}.`;

  return `GitLab responded ${status} for ${describe}.`;
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

  return transport
    .request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${normalizeGitLabHost(credentials.host)}/api/v4${path}`, options.query),
      body: options.body,
      headers: {
        // GitLab reads a personal access token from this header. `Authorization: Bearer` is for OAuth
        // tokens only, and a PAT sent that way is rejected as invalid rather than as unauthorized.
        'private-token': credentials.token,
        accept: 'application/json',
      },
    })
    .pipe(
      map((response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new GitLabRequestError({
            status: response.status,
            describe,
            message: messageFor({ status: response.status, describe, path }),
          });
        }

        return response;
      }),
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
    map((response) => (Array.isArray(response.body) ? response.body : [])),
    reduce((all: T[], items) => [...all, ...items], []),
  );
};
