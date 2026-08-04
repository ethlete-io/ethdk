/**
 * How deep a value is walked before it is replaced by a marker, and how much of a long string or a long
 * array survives. A report is read by a person, so a 5000-item list is worth two entries and a count.
 */
const MAX_DEPTH = 6;
const MAX_STRING = 200;
const MAX_ARRAY_ITEMS = 2;

/**
 * Slims a value for a shareable report: long strings are truncated and long arrays keep only the first
 * couple of entries, replacing the repetitive tail with a `… (N more)` marker, so a big response
 * collapses to a representative sample.
 */
export const slimForReport = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (depth > MAX_DEPTH) return '…';

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
    for (const [key, entry] of Object.entries(value)) out[key] = slimForReport(entry, depth + 1);

    return out;
  }

  return value;
};

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

export type BuildSessionExportOptions = {
  /** Wall-clock time of the export - passed in so the builder stays pure. */
  now: number;

  /** Where the session was captured, so a report says which environment it came from. */
  location: string;

  clients: SessionExportClient[];
  entries: SessionExportEntry[];
  events: SessionExportEvent[];
  faults: SessionExportFault[];
};

/** The whole panel state as one attachable JSON document. */
export type QueryDevtoolsSessionExport = {
  _type: 'ethlete.query:devtools-session';
  exportedAt: string;
  location: string;
  counts: { clients: number; entries: number; events: number; armedFaults: number };
  clients: SessionExportClient[];
  entries: SessionExportEntry[];
  events: SessionExportEvent[];
  faults: SessionExportFault[];
};

/** Slims the three free-form value fields of an entry, leaving the rest as it was collected. */
const slimEntry = (entry: SessionExportEntry): SessionExportEntry => ({
  ...entry,
  ...('args' in entry ? { args: slimForReport(entry.args) } : {}),
  ...('response' in entry ? { response: slimForReport(entry.response) } : {}),
  ...('error' in entry ? { error: slimForReport(entry.error) } : {}),
  ...(entry.detail ? { detail: slimForReport(entry.detail) as Record<string, unknown> } : {}),
});

/**
 * Builds the whole-session report: every registered entry with what it ran and what it holds, the event
 * log, the cache totals per client and anything armed in the Faults tab.
 *
 * Bodies are slimmed rather than dumped in full - the point is a file small enough to attach to a bug
 * report, and a 4 MB response says nothing a representative sample does not. Armed faults are included
 * because a report captured while the panel was lying to the app has to say so.
 */
export const buildQueryDevtoolsSessionExport = (options: BuildSessionExportOptions): QueryDevtoolsSessionExport => ({
  _type: 'ethlete.query:devtools-session',
  exportedAt: new Date(options.now).toISOString(),
  location: options.location,
  counts: {
    clients: options.clients.length,
    entries: options.entries.length,
    events: options.events.length,
    armedFaults: options.faults.length,
  },
  clients: options.clients,
  entries: options.entries.map(slimEntry),
  events: options.events,
  faults: options.faults,
});
