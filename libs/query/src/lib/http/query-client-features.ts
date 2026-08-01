import { DestroyRef } from '@angular/core';
import { htmlQueryErrorParser, symfonyQueryErrorParser } from './query-error-parsers';
import { registerQueryErrorParser, setDefaultQueryRetryFn } from './query-error-parsing';
import { shouldRetryRequest } from './query-retry-utils';
import { createIndexedDbQueryPersistenceAdapter } from './persistence/query-persistence-indexed-db';
import { QueryPersistenceConfig } from './persistence/query-persistence-config';
import { createQueryPersistenceEngine, QueryPersistenceEngine } from './persistence/query-persistence-engine';
import { QueryRepository } from './query-repository';
import { createQueryKeyLockManager } from './sync/query-key-lock-manager';
import { QueryMultiTabSyncConfig } from './sync/query-sync-config';
import { createQuerySyncEngine, QuerySyncEngine } from './sync/query-sync-engine';
import { createQuerySyncTransport } from './sync/query-sync-transport';

export const QueryClientFeatureType = {
  PERSISTENCE: 'PERSISTENCE',
  MULTI_TAB_SYNC: 'MULTI_TAB_SYNC',
  HTML_ERROR_PARSING: 'HTML_ERROR_PARSING',
  SYMFONY_ERRORS: 'SYMFONY_ERRORS',
  DEFAULT_RETRY: 'DEFAULT_RETRY',
  ETHLETE_API_ERRORS: 'ETHLETE_API_ERRORS',
} as const;

export type QueryClientFeatureType = (typeof QueryClientFeatureType)[keyof typeof QueryClientFeatureType];

/** What a query client hands to its features while it is being created. */
export type QueryClientFeatureContext = {
  /** The name the client was created with. */
  clientName: string;

  /** The client's repository. */
  repository: QueryRepository;

  /** The destroy ref of the injector the client was created in. */
  destroyRef: DestroyRef;

  /** Whether the client runs in a browser. Features must stay inert on the server. */
  isBrowser: boolean;
};

export type QueryClientMultiTabSyncFeature = {
  type: typeof QueryClientFeatureType.MULTI_TAB_SYNC;
  instance: QuerySyncEngine | null;
};

export type QueryClientPersistenceFeature = {
  type: typeof QueryClientFeatureType.PERSISTENCE;
  instance: QueryPersistenceEngine | null;
};

/**
 * A feature that only installs error-pipeline behavior. It has no per-client instance: how an error
 * body is read, and whether a failed request is retried, is a property of the app rather than of one
 * client.
 */
export type QueryClientErrorPipelineFeature = {
  type:
    | typeof QueryClientFeatureType.HTML_ERROR_PARSING
    | typeof QueryClientFeatureType.SYMFONY_ERRORS
    | typeof QueryClientFeatureType.DEFAULT_RETRY
    | typeof QueryClientFeatureType.ETHLETE_API_ERRORS;
  instance: null;
};

export type QueryClientFeature =
  QueryClientMultiTabSyncFeature | QueryClientPersistenceFeature | QueryClientErrorPipelineFeature;

export type QueryClientFeatureFn = (context: QueryClientFeatureContext) => QueryClientFeature;

/**
 * Coordinates a query client with its own instances in the user's **other tabs**, over a
 * `BroadcastChannel` and the Web Locks API. Three things happen once it is on:
 *
 * 1. a successful read is shared, so the same query shows the same data in every tab without a
 *    second request,
 * 2. the same cache key polled in several tabs is polled by one of them, the others being fed the
 *    result,
 * 3. a successful mutation in one tab refreshes what the other tabs currently have on screen.
 *
 * Always inert on the server, and a no-op in a browser without `BroadcastChannel`.
 *
 * The one thing it requires is that response bodies survive a structured clone, which JSON always
 * does; a body that cannot be cloned is warned about in dev mode and simply not shared. Individual
 * queries can stay tab-local via {@link BaseQueryCreatorOptions.multiTabSync} — worth doing for very
 * large payloads on a short polling interval.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withMultiTabSync()],
 * });
 */
export const withMultiTabSync =
  (config?: QueryMultiTabSyncConfig): QueryClientFeatureFn =>
  ({ clientName, repository, destroyRef, isBrowser }) => {
    // There are no other tabs to talk to on the server, and a per-request injector must not open a
    // channel it would then have to remember to close.
    if (!isBrowser) return { type: QueryClientFeatureType.MULTI_TAB_SYNC, instance: null };

    const syncConfig = config ?? {};
    const channelName = syncConfig.channelName ?? `et-query-sync-${clientName}`;

    const sync = createQuerySyncEngine({
      config: syncConfig,
      repository,
      transport: createQuerySyncTransport(channelName),
      // Keyed off the channel, not the client name: the channel is what says "these clients
      // are the same client, in different tabs", so the locks have to agree with it.
      lockManager: createQueryKeyLockManager(`et-query-poll:${channelName}`),
    });

    destroyRef.onDestroy(sync.destroy);

    return { type: QueryClientFeatureType.MULTI_TAB_SYNC, instance: sync };
  };

/**
 * Keeps a query client's successful reads on disk (IndexedDB), so a reload renders the last known
 * data right away instead of a loading state — and so does a cold start with no network at all.
 *
 * A hydrated response is **always** revalidated: persisted data fills a cache entry while its request
 * is already on its way, and never replaces something newer. What the user sees is last week's list
 * immediately, then this week's a moment later; offline, they see last week's list plus the error.
 *
 * Bounded by design: only successful reads are stored, **secure responses need an explicit
 * {@link BaseQueryCreatorOptions.persistence} on the query** (and are removed again on logout),
 * nothing older than `maxAge` is ever shown, and at most `maxEntries` responses are kept. Always
 * inert on the server and in a browser without IndexedDB.
 *
 * Bump {@link QueryPersistenceConfig.version} in the commit that changes what a response looks like —
 * that is what stops a returning user's disk copy from reaching code that can no longer read it.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withQueryPersistence()],
 * });
 */
export const withQueryPersistence =
  (config?: QueryPersistenceConfig): QueryClientFeatureFn =>
  ({ clientName, repository, destroyRef, isBrowser }) => {
    // A per-request injector has no disk to read and no session to remember, and `transferCache`
    // already covers the SSR hand-off to the browser.
    if (!isBrowser) return { type: QueryClientFeatureType.PERSISTENCE, instance: null };

    const persistenceConfig = config ?? {};

    const engine = createQueryPersistenceEngine({
      config: persistenceConfig,
      repository,
      adapter:
        (typeof persistenceConfig.adapter === 'function' ? persistenceConfig.adapter() : persistenceConfig.adapter) ??
        createIndexedDbQueryPersistenceAdapter({
          storageName: persistenceConfig.storageName ?? `et-query-persistence-${clientName}`,
        }),
    });

    // Writes are coalesced, so the tab going away is the one moment they cannot wait: a reload right
    // after a fetch is exactly the case persistence exists for. `visibilitychange` is what fires
    // reliably on mobile, where `pagehide` sometimes does not.
    const flush = () => void engine.flush();
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', flushWhenHidden);
    window.addEventListener('pagehide', flush);

    destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      window.removeEventListener('pagehide', flush);
      engine.destroy();
    });

    return { type: QueryClientFeatureType.PERSISTENCE, instance: engine };
  };

/**
 * Teaches the error pipeline to read an **HTML error page** - the 502 a proxy answers with, a
 * maintenance page, anything that is markup rather than JSON. Without it such a body is not
 * inspected at all and the error carries the `HttpErrorResponse`'s own message.
 *
 * The extractor and its entity table are ~0.9 kB gz that an app talking to a JSON-only API never
 * needs, which is why it is opt-in.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withHtmlErrorParsing()],
 * });
 */
export const withHtmlErrorParsing = (): QueryClientFeatureFn => () => {
  registerQueryErrorParser(htmlQueryErrorParser);

  return { type: QueryClientFeatureType.HTML_ERROR_PARSING, instance: null };
};

/**
 * Teaches the error pipeline the shapes a Symfony/API-Platform backend and a NestJS class-validator
 * pipeline answer with: a form violation list (`{ violations: [...] }`), a bare violation array, and
 * `{ message: string[] }`. Without it a form response with several field violations is read by the
 * built-in ladder, which sees no `message` string and falls back to the response's own message.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withSymfonyErrors()],
 * });
 */
export const withSymfonyErrors = (): QueryClientFeatureFn => () => {
  registerQueryErrorParser(symfonyQueryErrorParser);

  return { type: QueryClientFeatureType.SYMFONY_ERRORS, instance: null };
};

/**
 * Installs the SDK's default retry policy for every request that does not bring its own `retryFn`:
 * retry a connection failure indefinitely, a 5xx above 500, a 408/425, and a 429 (honouring
 * `retry-after`), up to three times with a backing-off delay - and never a Pagerfanta out-of-range
 * page.
 *
 * Without it nothing is retried automatically and `error.retryState` always reads `{ retry: false }`.
 * A per-client or per-creator `retryFn` keeps working either way.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withDefaultRetry()],
 * });
 */
export const withDefaultRetry = (): QueryClientFeatureFn => () => {
  setDefaultQueryRetryFn(shouldRetryRequest);

  return { type: QueryClientFeatureType.DEFAULT_RETRY, instance: null };
};

/**
 * Everything the error pipeline used to do before it became opt-in: {@link withHtmlErrorParsing},
 * {@link withSymfonyErrors} and {@link withDefaultRetry} in one feature. The soft landing for an app
 * talking to an Ethlete API - and the right default for any Symfony backend behind a proxy.
 *
 * Prefer the individual features once you know which of the three the API actually needs; each one
 * left out is code the app stops shipping.
 *
 * @example
 * const MY_CLIENT = createQueryClient({
 *   name: 'my-api',
 *   baseUrl: 'https://api.example.com',
 *   features: [withEthleteApiErrors()],
 * });
 */
export const withEthleteApiErrors = (): QueryClientFeatureFn => () => {
  registerQueryErrorParser(htmlQueryErrorParser);
  registerQueryErrorParser(symfonyQueryErrorParser);
  setDefaultQueryRetryFn(shouldRetryRequest);

  return { type: QueryClientFeatureType.ETHLETE_API_ERRORS, instance: null };
};
