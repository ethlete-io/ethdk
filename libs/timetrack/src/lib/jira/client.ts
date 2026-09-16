import { Observable, map, throwError } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';
import { carriesCredentialsSafely, insecureHostMessage } from '../transport/secure-host';

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

/** Long enough for the two or three fields a create call is rejected over, short enough for a banner. */
const MAX_JIRA_REASON_LENGTH = 300;

type JiraErrorBody = {
  errorMessages?: unknown;
  errors?: unknown;
};

/**
 * What Jira says it rejected. A 400 on a create call names the field in `errors`, and that name is
 * the only part of the answer that says what to change — a bare status leaves the user guessing
 * which of an instance's required fields this project added.
 */
const reasonOf = (body: unknown) => {
  if (typeof body !== 'object' || body === null) return undefined;

  const { errorMessages, errors } = body as JiraErrorBody;
  const general = Array.isArray(errorMessages) ? errorMessages.map((entry) => String(entry)) : [];
  const named =
    typeof errors === 'object' && errors !== null
      ? Object.entries(errors as Record<string, unknown>).map(([field, message]) => `${field}: ${String(message)}`)
      : [];
  const all = [...general, ...named].filter((entry) => !!entry.trim());

  return all.length ? all.join(' ').slice(0, MAX_JIRA_REASON_LENGTH) : undefined;
};

const messageFor = (options: { status: number; describe: string; reason?: string }) => {
  const { status, describe, reason } = options;
  const suffix = reason ? ` — ${reason}` : '';

  if (status === 401 || status === 403) return `Jira rejected the credentials (${status}) for ${describe}${suffix}.`;
  if (status === 404) return `Jira has no ${describe}, or the token cannot see it${suffix}.`;
  if (status === 429) return `Jira rate-limited the request for ${describe}${suffix}.`;

  return `Jira responded ${status} for ${describe}${suffix}.`;
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
  const base = normalizeJiraHost(credentials.host);

  if (!carriesCredentialsSafely(base)) {
    return throwError(
      () =>
        new JiraRequestError({
          status: 0,
          describe,
          message: insecureHostMessage({ provider: 'Jira', url: base }),
        }),
    );
  }

  return transport
    .request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${base}${path}`, options.query),
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
            message: messageFor({ status: response.status, describe, reason: reasonOf(response.body) }),
          });
        }

        return response.body;
      }),
    );
};
