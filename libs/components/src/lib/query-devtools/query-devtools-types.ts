import {
  AnyPagedQueryStack,
  AnyQueryStack,
  HttpRequestLoadingProgressState,
  HttpRequestRetryState,
  Query,
  QueryClient,
  QueryDevtoolsEntry,
  QueryDevtoolsRun,
  QueryDevtoolsStats,
  QueryDevtoolsStatsHandle,
  QueryKeyLockState,
  QueryRefreshCause,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QueryRepositoryEntryDestroyedCause,
} from '@ethlete/query';

// The registry stores queries type-erased; the panel reads them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQuery = Query<any>;

/** The query a detail pane is showing, together with the registry entry it was registered as. */
export type QueryDevtoolsSelection = { entry: QueryDevtoolsEntry; query: AnyQuery };

/**
 * A body the panel can show. Every one of them but `settings` is a tab in the bar: Settings holds nothing
 * to count, so the badge/overflow logic would push it behind **More** - it is reached from the header's
 * gear instead.
 */
export type DevtoolsTab =
  | 'queries'
  | 'stacks'
  | 'sequences'
  | 'forms'
  | 'auth'
  | 'ws'
  | 'cache'
  | 'timeline'
  | 'events'
  | 'faults'
  | 'mocks'
  | 'about'
  | 'settings';

/**
 * The sections of the query detail drawer. The head and its actions stay pinned above them - the detail
 * holds more than fits a column, and everything below the actions is reading material.
 */
export type DetailTab = 'overview' | 'history' | 'data';

/**
 * Which pane of a two-pane tab a divider drag sizes: the Queries tab's list, or the drawer every
 * split view opens a query in.
 */
export type PaneTarget = 'list' | 'drawer';

/** The axis a two-pane tab splits along: the panes sit side by side, or stack in a side dock. */
export type PaneAxis = 'inline' | 'block';

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * A facet the Queries list can be narrowed to. The first four describe live state; `gone` is the odd
 * one out - it is the only way a destroyed query's tombstone enters the list at all, which is why it
 * is off by default rather than just another filter over what is already shown.
 */
export type QueryListFacet = 'error' | 'loading' | 'stale' | 'idle' | 'gone';

/** The fault fields the panel arms from a number input, as opposed to the status it picks from a list. */
export type NumericFaultField = 'latencyMs' | 'failNext' | 'failRate';

/**
 * A chunk of a route as rendered: literal path text, a path param (`name` is the param it fills in) or
 * the query string of the request that ran. The kind becomes the segment's class.
 */
export type RouteSegment = { text: string; kind: 'static' | 'param' | 'query'; name?: string };

/**
 * Which tab refreshes an auth provider's tokens, as the auth tab's chip renders it. `title` carries
 * the caveats the label has no room for - why every tab reads as the leader, or how approximate the
 * tab count is.
 */
export type QueryDevtoolsLeadership = { label: string; tone: 'success' | 'muted'; title: string };

/** An auth provider's access-token expiry as the auth tab renders it, armed override included. */
export type QueryDevtoolsTokenLifetime = {
  /** Countdown to the expiry the app currently acts on, overridden or not. */
  expiresIn: string | null;

  /** Countdown to the token's own `exp`, and only set while an override is making it read differently. */
  realExpiresIn: string | null;

  /** The armed lifetime in seconds, or `null` while the token is on the one it was issued with. */
  ttlSeconds: number | null;

  /** Whether an override can be applied at all - the token needs an `exp` plus an `iat` or `nbf`. */
  overridable: boolean;
};

/** A query reachable from a stack or sequence card, rendered as a row that opens the detail drawer. */
export type QueryLink = {
  id: string;
  query: AnyQuery;
  method: string;
  segments: RouteSegment[];
  clientBaseUrl: string;
  stats?: QueryDevtoolsStatsHandle;
};

/**
 * Query stats plus the numbers the panel derives from them rather than storing: an execution that never
 * reached the network was answered from the cache, and the averages come from the running totals.
 */
export type QueryActivity = {
  stats: QueryDevtoolsStats;
  cacheServed: number;
  avgDurationMs: number | null;
  avgResponseBytes: number | null;
  hasActivity: boolean;
};

/**
 * What a query's request is doing beyond `loading`: which attempt it is on, the backoff it is waiting
 * out, and how much of the payload has moved. Without it a request retried three times behind a 4s
 * backoff and a plain slow one are the same yellow dot.
 */
export type RequestProgress = {
  /** @see HttpRequestSubtle.attempts */
  attempts: number;

  retry: HttpRequestRetryState | null;

  /** How much of the pending backoff is left, or `null` when none is pending. */
  retryInMs: number | null;

  progress: HttpRequestLoadingProgressState | null;
};

/**
 * One run of one query, placed on the timeline's shared axis. `leftPct` / `widthPct` are percentages of
 * the window every row is laid out against, which is what makes overlapping runs visible as overlap.
 */
export type TimelineRow = {
  key: string;
  entryId: string;
  method: string;
  path: string;
  run: QueryDevtoolsRun;
  leftPct: number;
  widthPct: number;

  /** How long the run took, or `null` while it is still in flight. */
  durationMs: number | null;
};

export type Timeline = {
  rows: TimelineRow[];

  /** The start of the window the rows are laid out against. */
  startedAt: number;

  /** How long that window is - the axis every bar is a fraction of. */
  windowMs: number;

  /** How many older runs the view left out, so a capped timeline does not read as a complete one. */
  hidden: number;
};

/**
 * One request a refresh re-executed, as an event row lists it. A cache key is shared by every query
 * bound to it, so the row carries all of their ids - one to open, and the rest so each of those queries
 * can still find the refresh under "Refetched by". Empty for a request no registered query holds.
 */
export type RefreshedRequest = {
  queryIds: string[];
  method: string;
  path: string;
};

export type EventLogItem = {
  id: number;
  timestamp: number;
  client: string;
  type:
    | 'entry-created'
    | 'request-success'
    | 'request-error'
    | 'entry-destroyed'
    | 'unbind-all-secure'
    | 'queries-refreshed';

  /** `null` for events that are not about a single request, e.g. the logout-wide secure unbind. */
  method: string | null;
  url: string | null;
  isSecure: boolean;
  status: number | null;

  /**
   * The registered query the request belonged to when the event fired, so the row can open it. Resolved
   * here rather than at click time so the log holds an id instead of a reference to the request itself.
   */
  queryId: string | null;

  /** What asked for a refresh, for a `queries-refreshed` row. `null` for every other type. */
  cause: QueryRefreshCause | null;

  /** Why a cache entry was torn down, for an `entry-destroyed` row. `null` for every other type. */
  destroyCause: QueryRepositoryEntryDestroyedCause | null;

  /** The requests that refresh re-executed - the fan-out the panel could not show before. */
  refreshed: RefreshedRequest[] | null;

  /**
   * How long the request took and how big its response was, read off the request as the event fired.
   * Both `null` for an event that is not one request settling, and the size also for a failure - an
   * error body is not a payload worth a column.
   */
  durationMs: number | null;
  bytes: number | null;

  /** @see QueryDevtoolsStats.hasEstimatedBytes */
  isEstimatedBytes: boolean;
};

/**
 * A cache entry that is gone, as the Cache tab still lists it. Deliberately not a {@link CacheRow}: a
 * destroyed entry has no consumers, no size, no freshness and nothing to act on, so a full row would be
 * seven columns of dashes. What is left worth showing is what it was and why it went.
 */
export type DroppedCacheEntry = {
  client: string;
  method: string;
  url: string;
  cause: QueryRepositoryEntryDestroyedCause;
  at: number;
};

/** How the panel spells a teardown cause out - the same wording in the Events tab and the Cache tab. */
export const DESTROY_CAUSE_LABELS: Record<QueryRepositoryEntryDestroyedCause, string> = {
  unbind: 'last consumer gone',
  expired: 'unused window over',
  'unused-cap': 'unused entry cap',
  logout: 'logout',
  manual: 'evicted',
};

/** One cache entry as the Cache tab lists it: the repository's own snapshot plus its measured size. */
export type CacheRow = {
  entry: QueryRepositoryCacheEntry;
  bytes: number;
  isEstimatedBytes: boolean;
};

/** A repository the panel found, together with the client name/base URL it was registered under. */
export type RepositoryInfo = { repository: QueryRepository; name: string; baseUrl: string; client: QueryClient | null };

/** One client's cache, as the Cache tab lists it - every entry measured, with the client's poll states. */
export type CacheView = {
  name: string;
  baseUrl: string;
  repository: QueryRepository;
  rows: CacheRow[];
  bytes: number;
  isEstimatedBytes: boolean;
  unused: number;
  pollStates: Record<string, QueryKeyLockState>;
  client: QueryClient | null;

  /** The entries this client has lost since the panel was loaded, newest first. */
  dropped: DroppedCacheEntry[];
};

/** What each tab holds, as its badge reports it: how many entries, and how many of them are failing. */
export type TabBadge = { count: number; errors: number; errorNoun?: string };

export type { AnyPagedQueryStack, AnyQueryStack };
