import { Observable, map } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';

/**
 * A Jira Cloud API token, which is Basic auth over the account email — not the same secret as
 * Tempo's bearer token, and kept in a separate keychain entry.
 */
export type JiraCredentials = {
  host: string;
  email: string;
  token: string;
};

export class JiraRequestError extends Error {
  readonly status: number;
  readonly describe: string;

  constructor(options: { status: number; describe: string; message: string }) {
    super(options.message);
    this.name = 'JiraRequestError';
    this.status = options.status;
    this.describe = options.describe;
  }
}

export type JiraQuery = Record<string, string | number | boolean | undefined>;

/** Trailing slashes and a missing scheme both produce a URL Jira answers with a redirect, not data. */
export const normalizeJiraHost = (host: string) =>
  (/^https?:\/\//.test(host) ? host : `https://${host}`).replace(/\/+$/, '');

const encodeCredentials = (credentials: JiraCredentials) => {
  const bytes = new TextEncoder().encode(`${credentials.email}:${credentials.token}`);

  return btoa(String.fromCharCode(...bytes));
};

const withQuery = (url: string, query: JiraQuery | undefined) => {
  const params = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);

  return params.length === 0
    ? url
    : `${url}?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
};

const messageFor = (options: { status: number; describe: string }) => {
  const { status, describe } = options;

  if (status === 401 || status === 403) return `Jira rejected the credentials (${status}) for ${describe}.`;
  if (status === 404) return `Jira has no ${describe}, or the token cannot see it.`;
  if (status === 429) return `Jira rate-limited the request for ${describe}.`;

  return `Jira responded ${status} for ${describe}.`;
};

/**
 * Issues one Jira REST v3 call through the host transport. The core never calls `fetch` itself —
 * Jira rejects browser-origin requests, and the token must not be reachable from the webview.
 */
export const jiraRequest$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: JiraCredentials;
  path: string;
  describe: string;
  method?: TimetrackRequestMethod;
  query?: JiraQuery;
  body?: unknown;
}): Observable<T> => {
  const { transport, credentials, path, describe } = options;

  return transport
    .request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${normalizeJiraHost(credentials.host)}${path}`, options.query),
      headers: {
        authorization: `Basic ${encodeCredentials(credentials)}`,
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body,
    })
    .pipe(
      map((response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new JiraRequestError({
            status: response.status,
            describe,
            message: messageFor({ status: response.status, describe }),
          });
        }

        return response.body;
      }),
    );
};
