import type { QueryMethod } from '../query-creator';

/** A mutation that succeeded in another tab. */
export type QuerySyncMutation = {
  /** The HTTP method of the mutation. */
  method: QueryMethod;

  /** The full URL the mutation was sent to, including its query params. */
  url: string;
};

/** A query of *this* tab that is up for a mutation-driven refresh. */
export type QuerySyncRefreshCandidate = {
  /** The HTTP method of the query. Always a cacheable read method. */
  method: QueryMethod;

  /** The full URL of the query, including its query params. */
  url: string;
};

/**
 * Decides whether a query in this tab should be refreshed because of a mutation in another one.
 * @see QueryMultiTabSyncConfig.refreshOnMutation
 */
export type QuerySyncMutationFilterFn = (mutation: QuerySyncMutation, query: QuerySyncRefreshCandidate) => boolean;

export type QuerySyncRefreshOnMutationConfig = {
  /**
   * Narrows which queries a mutation in another tab refreshes. Both sides are given as
   * `{ method, url }`, with fully built URLs.
   *
   * @example
   * // Only refresh queries under the same first path segment as the mutation.
   * const segment = (url: string) => new URL(url).pathname.split('/')[1];
   *
   * refreshOnMutation: { filter: (mutation, query) => segment(mutation.url) === segment(query.url) }
   */
  filter: QuerySyncMutationFilterFn;
};

/**
 * Cross-tab coordination for a query client.
 * @see CreateQueryClientConfigOptions.multiTabSync
 */
export type QueryMultiTabSyncConfig = {
  /**
   * The `BroadcastChannel` name the tabs talk over. One channel per client, so two clients never
   * cross-talk — only override this if two separately created clients must share one channel.
   *
   * @default `et-query-sync-${client name}`
   */
  channelName?: string;

  /**
   * Whether a successful read is broadcast to the other tabs, which apply it to their cache entry for
   * the same key. This is the foundation the rest builds on: without it a suppressed poll would leave
   * the other tab with no data, so `dedupePolling` is inert while this is `false`.
   *
   * @default true
   */
  syncResponses?: boolean;

  /**
   * Whether polling the same cache key in several tabs is reduced to one tab doing the work, with the
   * result reaching the others via `syncResponses`. Requires `syncResponses`.
   *
   * @default true
   */
  dedupePolling?: boolean;

  /**
   * Whether a successful mutation in one tab refreshes the queries the *other* tabs currently have on
   * screen. Pass a `filter` to narrow that down; the default refreshes every in-use query of the
   * client, which over-fetches in the worst case but can never miss a list route that a
   * path-prefix guess would (`PUT /players/1` also invalidates `/leagues/1/players`).
   *
   * The mutating tab itself is untouched — refreshing locally after a mutation stays the app's job,
   * as it is without sync.
   *
   * @default true
   */
  refreshOnMutation?: boolean | QuerySyncRefreshOnMutationConfig;
};
