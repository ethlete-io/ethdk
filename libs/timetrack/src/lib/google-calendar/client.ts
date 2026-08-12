import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { TimetrackRequestMethod, TimetrackTransport } from '../transport/ports';

/**
 * A Google access token for the user's own OAuth client. The host owns the whole OAuth dance — PKCE,
 * the loopback redirect, the keychain and the refresh — and hands the core a token that is currently
 * valid; the core neither stores nor renews one.
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

  constructor(options: { status: number; describe: string; reason?: string; message: string }) {
    super(options.message);
    this.name = 'GoogleCalendarRequestError';
    this.status = options.status;
    this.describe = options.describe;
    this.reason = options.reason;
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

const withQuery = (url: string, query: GoogleCalendarQuery | undefined) => {
  const params = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);

  return params.length === 0
    ? url
    : `${url}?${params.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
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

  return transport
    .request$<T>({
      method: options.method ?? 'GET',
      url: withQuery(`${GOOGLE_CALENDAR_API_BASE}${path}`, options.query),
      headers: {
        authorization: `Bearer ${credentials.accessToken}`,
        accept: 'application/json',
      },
    })
    .pipe(
      map((response) => {
        if (response.status < 200 || response.status >= 300) {
          const reason = reasonOf(response.body);

          throw new GoogleCalendarRequestError({
            status: response.status,
            describe,
            reason,
            message: messageFor({ status: response.status, describe, reason }),
          });
        }

        return response.body;
      }),
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

/** Follows `nextPageToken` until Google stops offering one, and concatenates every page's items. */
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
    expand((page, index) => (page.nextPageToken && index < maxPages - 1 ? page$(page.nextPageToken) : EMPTY)),
    map((page) => page.items ?? []),
    reduce((all: T[], items) => [...all, ...items], []),
  );
};
