import { EMPTY, Observable, defer, expand, map, throwError, toArray } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';
import { withQuery } from '../transport/query';
import { responseHeaderOf, retryAfterMsOf, retryWhenRateLimited } from '../transport/rate-limit';

/**
 * A Google access token for the user's own OAuth client that is valid right now. The calendar calls
 * neither store nor renew it; `createGoogleTokenSource` does the renewing.
 */
export type GoogleCalendarCredentials = {
  accessToken: string;
};

export const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/** Google answers a quota breach with 403 as often as with 429, distinguished only by the reason. */
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'];

export class GoogleCalendarRequestError extends Error {
  readonly status: number;
  readonly describe: string;
  /** Google's own machine-readable cause, when the error body named one. */
  readonly reason?: string;
  /** True for both of Google's rate-limit shapes, which is what makes the request worth retrying. */
  readonly rateLimited: boolean;
  /** The wait the response's `Retry-After` asked for. */
  readonly retryAfterMs?: number;

  constructor(options: { status: number; describe: string; reason?: string; message: string; retryAfterMs?: number }) {
    super(options.message);
    this.name = 'GoogleCalendarRequestError';
    this.status = options.status;
    this.describe = options.describe;
    this.reason = options.reason;
    this.retryAfterMs = options.retryAfterMs;
    this.rateLimited = options.status === 429 || RATE_LIMIT_REASONS.includes(options.reason ?? '');
  }
}

export type GoogleCalendarQuery = Record<string, string | number | boolean | undefined>;

type GoogleErrorBody = {
  error?: {
    message?: string;
    errors?: { reason?: string }[];
  };
};

const reasonOf = (body: unknown) =>
  typeof body === 'object' && body !== null ? (body as GoogleErrorBody).error?.errors?.[0]?.reason : undefined;

const messageFor = (options: { status: number; describe: string; reason?: string }) => {
  const { status, describe, reason } = options;
  const suffix = reason ? ` (${reason})` : '';

  if (RATE_LIMIT_REASONS.includes(reason ?? '') || status === 429) {
    return `Google rate-limited the request for ${describe}${suffix}.`;
  }

  if (status === 401) return `Google rejected the access token for ${describe} — it needs refreshing.`;
  if (status === 403) return `The token is not allowed to read ${describe}${suffix} — check the granted scopes.`;
  if (status === 404) return `Google has no ${describe}, or the token cannot see it.`;

  return `Google responded ${status} for ${describe}${suffix}.`;
};

/** Issues one Google Calendar v3 call through the host transport. */
export const googleCalendarRequest$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: GoogleCalendarCredentials;
  path: string;
  describe: string;
  method?: TimetrackRequestMethod;
  query?: GoogleCalendarQuery;
}): Observable<T> => {
  const { transport, credentials, path, describe } = options;

  return defer(() =>
    transport.request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${GOOGLE_CALENDAR_API_BASE}${path}`, options.query),
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        accept: 'application/json',
      },
    }),
  ).pipe(
    map((response) => {
      if (response.status < 200 || response.status >= 300) {
        const reason = reasonOf(response.body);

        throw new GoogleCalendarRequestError({
          status: response.status,
          describe,
          reason,
          message: messageFor({ status: response.status, describe, reason }),
          retryAfterMs: retryAfterMsOf(responseHeaderOf(response.headers, 'retry-after')),
        });
      }

      return response.body;
    }),
    retryWhenRateLimited((error) =>
      error instanceof GoogleCalendarRequestError && error.rateLimited ? { retryAfterMs: error.retryAfterMs } : null,
    ),
  );
};

export type GoogleCalendarPage<T> = {
  items?: T[];
  nextPageToken?: string;
};

export type GoogleCalendarPagingOptions = {
  /** Items per request. Google's own cap is 2500 for events and 250 for the calendar list. */
  pageSize: number;
  /** A wide window must not page forever against a quota-limited API. */
  maxPages: number;
};

export const DEFAULT_GOOGLE_CALENDAR_PAGING_OPTIONS: GoogleCalendarPagingOptions = {
  pageSize: 250,
  maxPages: 20,
};

/**
 * Follows `nextPageToken` until Google stops offering one, and concatenates every page's items. Fails
 * when Google still offers a page after `maxPages`, rather than answering with part of the list.
 */
export const googleCalendarPaged$ = <T>(options: {
  transport: TimetrackTransport;
  credentials: GoogleCalendarCredentials;
  path: string;
  describe: string;
  query?: GoogleCalendarQuery;
  options?: Partial<GoogleCalendarPagingOptions>;
}): Observable<T[]> => {
  const { pageSize, maxPages } = { ...DEFAULT_GOOGLE_CALENDAR_PAGING_OPTIONS, ...options.options };
  const page$ = (pageToken?: string) =>
    googleCalendarRequest$<GoogleCalendarPage<T>>({
      transport: options.transport,
      credentials: options.credentials,
      path: options.path,
      describe: options.describe,
      query: { ...options.query, maxResults: pageSize, pageToken },
    });

  return page$().pipe(
    expand((page, index) => {
      if (!page.nextPageToken) return EMPTY;
      if (index >= maxPages - 1) {
        return throwError(() => new Error(`Google offered more than ${maxPages} pages for ${options.describe}.`));
      }

      return page$(page.nextPageToken);
    }),
    toArray(),
    map((pages) => pages.flatMap((page) => page.items ?? [])),
  );
};
