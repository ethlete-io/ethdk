import { QueryDevtoolsAbout } from '@ethlete/query';

/**
 * How deep a value is walked before it is replaced by a marker, and how much of a long string or a long
 * array survives. A report is read by a person, so a 5000-item list is worth two entries and a count.
 */
const MAX_DEPTH = 6;
const MAX_STRING = 200;
const MAX_ARRAY_ITEMS = 2;

/** What a redacted credential is written as, so a reader can tell it from a value the app never sent. */
export const REDACTED_SECRET = '[redacted: credential]';

/** What the args, response and error of a bearer auth provider's own query are written as. */
export const REDACTED_AUTH_QUERY = '[redacted: auth query]';

/**
 * Key fragments that name a credential. Matched against the key with every separator removed, so
 * `accessToken`, `access_token`, `X-Api-Key` and `set-cookie` all reduce to the same word.
 */
const SECRET_KEY_FRAGMENTS = [
  'apikey',
  'accesskey',
  'authorization',
  'bearer',
  'cookie',
  'credential',
  'jwt',
  'passphrase',
  'passwd',
  'password',
  'privatekey',
  'pwd',
  'secret',
  'sessionid',
  'token',
];

/**
 * Whether a key names a credential. The one rule both the session report and the Insomnia export
 * redact by, so a value the report would blank out cannot travel in a collection instead.
 */
export const isSecretKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  return SECRET_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
};

/**
 * Booleans and numbers under a credential-named key are kept: `hasAccessToken: true` and
 * `expiresIn: 900` are what a report is for, and neither can carry the credential itself.
 */
const holdsSecret = (value: unknown) =>
  typeof value === 'string' ? value.length > 0 : !!value && typeof value === 'object';

/**
 * Slims a value for a shareable report: long strings are truncated and long arrays keep only the first
 * couple of entries, replacing the repetitive tail with a `… (N more)` marker, so a big response
 * collapses to a representative sample. A `Date`, `Map`, `Set`, `Error` or `bigint` is written as
 * something a reader can still read. Anything under a credential-named key is replaced by
 * {@link REDACTED_SECRET} instead - a report travels to a ticket, so a password or a bearer token must
 * not be in it however deep in a body it sits.
 */
export const slimForReport = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  // `JSON.stringify` throws on a bigint, which would take the whole export down with it.
  if (typeof value === 'bigint') return `${value}`;
  if (depth > MAX_DEPTH) return '…';

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: slimForReport(value.stack, depth + 1) };
  }
  // `Object.entries` on a `Map`, a `Set` or an `Error` is `[]`, so the branch below would write the one
  // field a report exists for as `{}`.
  if (value instanceof Map) return slimForReport([...value], depth);
  if (value instanceof Set) return slimForReport([...value], depth);

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS + 1) {
      return [
        ...value.slice(0, MAX_ARRAY_ITEMS).map((entry) => slimForReport(entry, depth + 1)),
        `… (${value.length - MAX_ARRAY_ITEMS} more)`,
      ];
    }

    return value.map((entry) => slimForReport(entry, depth + 1));
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [entryKey, entry] of Object.entries(value)) {
      out[entryKey] = isSecretKey(entryKey) && holdsSecret(entry) ? REDACTED_SECRET : slimForReport(entry, depth + 1);
    }

    return out;
  }

  return value;
};

/**
 * The key an entry is matched by when deciding whether it is one of a bearer auth provider's own login
 * or token-refresh queries: those are ordinary registered queries, and the client, method and route are
 * what the provider's description and the query's own registration both carry. A GraphQL entry's method
 * reads `GQL POST` in the panel and `POST` in the provider's description, so the prefix is dropped.
 */
export const sessionAuthQueryKey = (parts: { client?: string | null; method?: string | null; route?: string | null }) =>
  `${parts.client ?? ''}|${(parts.method ?? '').toUpperCase().replace(/^GQL /, '')}|${parts.route ?? ''}`;

/** One query client, as the export accounts for it. */
export type SessionExportClient = {
  name: string;
  baseUrl: string;

  /** How many entries the client's repository holds, and how many of those have no consumer left. */
  cacheEntries: number;
  unusedCacheEntries: number;

  /** The measured size of everything in that cache. */
  cacheBytes: number;

  /** How many responses the client has on disk, or `null` for a client without persistence. */
  persistedEntries: number | null;

  features: string[];
};

/**
 * One registered entry - a query, stack, sequence, form, auth provider or socket. Everything past `kind`
 * is optional because it is filled in per kind: only a query has runs, only a socket has messages.
 */
export type SessionExportEntry = {
  id: string;
  kind: string;
  name?: string | null;
  client?: string | null;
  method?: string | null;

  /** The route template, e.g. `/post/:postId`. */
  route?: string | null;

  /** The URL of the request it last made. */
  url?: string | null;
  status?: string | null;
  features?: string[];
  activity?: Record<string, unknown> | null;
  runs?: Record<string, unknown>[];

  /** Values slimmed by {@link slimForReport} on the way out. */
  args?: unknown;
  response?: unknown;
  error?: unknown;

  /** Whatever else the kind carries: a stack's pages, a form's fields, a socket's rooms. */
  detail?: Record<string, unknown> | null;

  /**
   * The response overrides armed on this query, for a query entry - a report captured while one was
   * live has to say so, the same reason armed faults are included.
   */
  overrides?: { id: string; op: Record<string, unknown> }[];
};

export type SessionExportEvent = {
  timestamp: string;
  client: string;
  type: string;
  method?: string | null;
  url?: string | null;
  status?: number | null;
  durationMs?: number | null;
  bytes?: number | null;
  cause?: string | null;
  refreshed?: string[] | null;
};

export type SessionExportFault = {
  client: string;
  latencyMs: number;
  failNext: number;
  failRate: number;
  status: number;
};

/**
 * One armed mock, as a capture reports it. A session taken while a route was answered by the panel has to
 * say which routes those were, or the report sends someone looking for data the API never sent.
 */
export type SessionExportMock = {
  client: string;
  method: string;
  pattern: string;
  status: number;
  latencyMs: number;
  body: unknown;
};

export type BuildSessionExportOptions = {
  /** Wall-clock time of the export - passed in so the builder stays pure. */
  now: number;

  /** Where the session was captured, so a report says which environment it came from. */
  location: string;

  /** Which SDK and application build produced the session - see `queryDevtoolsAbout()`. */
  about: QueryDevtoolsAbout;

  clients: SessionExportClient[];
  entries: SessionExportEntry[];
  events: SessionExportEvent[];
  faults: SessionExportFault[];
  mocks: SessionExportMock[];

  /**
   * The bearer auth providers' own login and token-refresh queries, keyed by
   * {@link sessionAuthQueryKey}. Whatever they sent and received is left out of the report entirely.
   */
  authQueryKeys?: readonly string[];
};

/** The whole panel state as one attachable JSON document. */
export type QueryDevtoolsSessionExport = {
  _type: 'ethlete.query:devtools-session';
  exportedAt: string;
  location: string;
  about: QueryDevtoolsAbout;
  counts: {
    clients: number;
    entries: number;
    events: number;
    armedFaults: number;
    armedOverrides: number;
    armedMocks: number;
  };
  clients: SessionExportClient[];
  entries: SessionExportEntry[];
  events: SessionExportEvent[];
  faults: SessionExportFault[];
  mocks: SessionExportMock[];
};

/** Slims the free-form value fields of an entry, leaving the rest as it was collected. */
const slimEntry = (entry: SessionExportEntry, authQueryKeys: ReadonlySet<string>): SessionExportEntry => {
  if (entry.kind === 'query' && authQueryKeys.has(sessionAuthQueryKey(entry))) {
    return {
      ...entry,
      ...('args' in entry ? { args: REDACTED_AUTH_QUERY } : {}),
      ...('response' in entry ? { response: REDACTED_AUTH_QUERY } : {}),
      ...('error' in entry ? { error: REDACTED_AUTH_QUERY } : {}),
      ...(entry.detail ? { detail: { redacted: REDACTED_AUTH_QUERY } } : {}),
    };
  }

  return {
    ...entry,
    ...('args' in entry ? { args: slimForReport(entry.args) } : {}),
    ...('response' in entry ? { response: slimForReport(entry.response) } : {}),
    ...('error' in entry ? { error: slimForReport(entry.error) } : {}),
    ...(entry.detail ? { detail: slimForReport(entry.detail) as Record<string, unknown> } : {}),
    ...(entry.overrides?.length
      ? { overrides: slimForReport(entry.overrides) as SessionExportEntry['overrides'] }
      : {}),
  };
};

/**
 * Builds the whole-session report: every registered entry with what it ran and what it holds, the event
 * log, the cache totals per client and anything armed in the Faults or Mocks tabs or as a response
 * override.
 *
 * Bodies are slimmed rather than dumped in full - the point is a file small enough to attach to a bug
 * report, and a 4 MB response says nothing a representative sample does not. Armed faults and overrides
 * are included because a report captured while the panel was lying to the app has to say so. Neither
 * survives past the current page - this is a snapshot for a bug report, not something the panel can
 * later import to restore a session.
 *
 * Credentials are the exception to "slimmed, not redacted": an auth provider's own queries are reported
 * without what they sent or received, and any credential-named key anywhere else in the file is replaced
 * by {@link REDACTED_SECRET}.
 */
export const buildQueryDevtoolsSessionExport = (options: BuildSessionExportOptions): QueryDevtoolsSessionExport => {
  const authQueryKeys = new Set(options.authQueryKeys ?? []);

  return {
    _type: 'ethlete.query:devtools-session',
    exportedAt: new Date(options.now).toISOString(),
    location: options.location,
    about: options.about,
    counts: {
      clients: options.clients.length,
      entries: options.entries.length,
      events: options.events.length,
      armedFaults: options.faults.length,
      armedOverrides: options.entries.reduce((sum, entry) => sum + (entry.overrides?.length ?? 0), 0),
      armedMocks: options.mocks.length,
    },
    clients: options.clients,
    entries: options.entries.map((entry) => slimEntry(entry, authQueryKeys)),
    events: options.events,
    faults: options.faults,
    mocks: options.mocks,
  };
};
