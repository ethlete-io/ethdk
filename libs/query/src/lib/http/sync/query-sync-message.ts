import { QueryMethod } from '../query-creator';
import { QueryKey } from '../query-repository';

/**
 * Version of the cross-tab message protocol. A tab ignores messages carrying a version it does not
 * know rather than guessing at a shape it has never seen - the realistic case being a user with the
 * previous deploy still open next to a freshly loaded one.
 *
 * Bump this whenever {@link QuerySyncMessage} changes in a way an older tab could misread. Skew
 * *within* one version (a response body whose shape changed server-side) is accepted risk, the same
 * as it is for the bearer auth token sync.
 *
 * Adding a whole new message *type* is not such a change and must not bump it: an older tab already
 * drops what it does not recognize (see {@link unwrapQuerySyncMessage}), whereas a bump would make it
 * drop the types it does know as well.
 */
export const QUERY_SYNC_PROTOCOL_VERSION = 1;

/** A cacheable request settled successfully in another tab. */
export type QuerySyncResponseMessage = {
  type: 'response';

  /** The cache key of the entry the response belongs to. Deterministic across tabs. */
  key: QueryKey;

  /** The response body, structured-cloned by the channel. */
  body: unknown;

  /** Timestamp (ms) at which the response goes stale, or `null` when it has no freshness window. */
  expiresAt: number | null;
};

/** A mutation settled successfully in another tab. */
export type QuerySyncMutationMessage = {
  type: 'mutation';

  /** The HTTP method of the mutation. */
  method: QueryMethod;

  /** The full URL the mutation was sent to. */
  url: string;
};

/** Another tab was told to invalidate queries, explicitly. */
export type QuerySyncInvalidateMessage = {
  type: 'invalidate';

  /**
   * The absolute URL the invalidation was narrowed to, or `null` for every query in use. Already
   * resolved by the tab that sent it - the two tabs run the same client, so its `baseUrl` is ours.
   */
  url: string | null;
};

export type QuerySyncMessage = QuerySyncResponseMessage | QuerySyncMutationMessage | QuerySyncInvalidateMessage;

/** What actually travels over the channel: a message plus the protocol version that produced it. */
export type QuerySyncEnvelope = QuerySyncMessage & { v: number };

export const wrapQuerySyncMessage = (message: QuerySyncMessage): QuerySyncEnvelope => ({
  ...message,
  v: QUERY_SYNC_PROTOCOL_VERSION,
});

/**
 * Validates an incoming channel payload and unwraps it, returning `null` for anything this tab
 * cannot safely act on: a foreign protocol version, or something that is not one of our messages at
 * all (a browser extension or another library posting on a colliding channel name).
 */
export const unwrapQuerySyncMessage = (data: unknown): QuerySyncMessage | null => {
  if (typeof data !== 'object' || data === null) return null;

  const raw = data as Record<string, unknown>;

  if (raw['v'] !== QUERY_SYNC_PROTOCOL_VERSION) return null;

  const type = raw['type'];
  const key = raw['key'];
  const method = raw['method'];
  const url = raw['url'];
  const expiresAt = raw['expiresAt'];

  if (type === 'response' && typeof key === 'string') {
    return {
      type: 'response',
      key,
      body: raw['body'],
      expiresAt: typeof expiresAt === 'number' ? expiresAt : null,
    };
  }

  if (type === 'mutation' && typeof method === 'string' && typeof url === 'string') {
    return { type: 'mutation', method: method as QueryMethod, url };
  }

  if (type === 'invalidate' && (typeof url === 'string' || url === null)) {
    return { type: 'invalidate', url };
  }

  return null;
};
