import type { QueryMethod } from './query-creator';
import type { QueryRepositoryRefreshFilterFn } from './query-repository';

/** A query of this client that an invalidation is deciding about. */
export type QueryInvalidationCandidate = {
  /** The HTTP method of the query. Always a cacheable read method. */
  method: QueryMethod;

  /** The full URL of the query, including its query params. */
  url: string;
};

/**
 * Decides whether a query should be refreshed by an invalidation.
 * @see QueryInvalidationOptions.filter
 */
export type QueryInvalidationFilterFn = (query: QueryInvalidationCandidate) => boolean;

/** @see QueryClient.invalidateQueries */
export type QueryInvalidationOptions = {
  /**
   * Narrows the invalidation to one part of the API. Given relative it is resolved against the
   * client's `baseUrl`, exactly like a query route; an absolute URL is taken as it is.
   *
   * Matching is boundary aware rather than a plain prefix test, so `/players` covers `/players`,
   * `/players/1` and `/players?page=2` — but not `/players-archive`.
   */
  url?: string;
  /**
   * Narrows the invalidation further, on the built `{ method, url }` of each candidate. Runs after
   * `url` when both are given.
   *
   * **Not broadcast** — a function cannot cross a `BroadcastChannel`, so the other tabs narrow by
   * `url` alone and invalidate a superset. Pair it with `otherTabs: false` when the two must agree.
   *
   * @example
   * // Everything below /players, except the one list the current route is already refetching itself.
   * client.invalidateQueries({ url: '/players', filter: (query) => !query.url.includes('page=1') });
   */
  filter?: QueryInvalidationFilterFn;

  /**
   * Whether the user's other tabs invalidate the same queries. Requires
   * {@link CreateQueryClientConfigOptions.multiTabSync}, and is ignored when it is off.
   *
   * @default true
   */
  otherTabs?: boolean;
};

/**
 * Resolves an {@link QueryInvalidationOptions.url} to the absolute form request URLs are built in, so
 * the comparison — and the message the other tabs receive — never depends on who resolves it.
 */
export const resolveInvalidationUrl = (baseUrl: string, url: string): string => {
  const absolute = url.startsWith('/') ? `${baseUrl}${url}` : url;

  // A trailing slash would put the boundary check below one character past where the URL actually
  // ends, which is the one way `/players/` could fail to match `/players/1`.
  return absolute.endsWith('/') ? absolute.slice(0, -1) : absolute;
};

/**
 * Whether a query URL is the invalidated one or sits below it. The check on what follows the prefix
 * is what keeps `/players` from matching `/players-archive`, which a `startsWith` alone would.
 */
export const isUnderInvalidatedUrl = (queryUrl: string, invalidatedUrl: string): boolean => {
  if (!queryUrl.startsWith(invalidatedUrl)) return false;

  const rest = queryUrl.slice(invalidatedUrl.length);

  return rest === '' || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('#');
};

/**
 * Turns an invalidation into the filter the repository refreshes by, or `undefined` when nothing
 * narrows it — "everything in use" is the repository's own cheapest path.
 */
export const createQueryInvalidationFilter = (options: {
  url: string | null;
  filter?: QueryInvalidationFilterFn;
}): QueryRepositoryRefreshFilterFn | undefined => {
  const { url, filter } = options;

  if (!url && !filter) return undefined;

  return (request) => {
    if (url && !isUnderInvalidatedUrl(request.url, url)) return false;

    return filter ? filter({ method: request.method, url: request.url }) : true;
  };
};
