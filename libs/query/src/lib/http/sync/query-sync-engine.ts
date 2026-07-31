import { shouldCacheQuery } from '../query-cache-utils';
import { QueryRepository, QueryRepositoryEvent } from '../query-repository';
import { QueryKeyLockManager } from './query-key-lock-manager';
import { QueryMultiTabSyncConfig } from './query-sync-config';
import { QuerySyncMessage } from './query-sync-message';
import { QuerySyncTransport } from './query-sync-transport';

/**
 * The per-client machinery behind {@link CreateQueryClientConfigOptions.multiTabSync}: it broadcasts
 * what settles in this tab, applies what settles in the others, and owns the lock manager that
 * decides which tab polls a given cache key.
 *
 * Reachable from query features via `deps.client.subtle.sync`, and `null` on a client that did not
 * enable sync (or on the server).
 */
export type QuerySyncEngine = {
  /**
   * Whether polling should be deduplicated across tabs. Already accounts for response sharing being
   * a prerequisite, so a feature can act on this alone.
   */
  isPollingDedupeEnabled: boolean;

  /** Elects the one tab responsible for a cache key. */
  lockManager: QueryKeyLockManager;

  /** Stops broadcasting and listening, and closes the channel. */
  destroy: () => void;
};

export type CreateQuerySyncEngineOptions = {
  config: QueryMultiTabSyncConfig;
  repository: QueryRepository;
  transport: QuerySyncTransport;
  lockManager: QueryKeyLockManager;
};

export const createQuerySyncEngine = (options: CreateQuerySyncEngineOptions): QuerySyncEngine => {
  const { config, repository, transport, lockManager } = options;

  const syncResponses = config.syncResponses ?? true;
  const refreshOnMutation = config.refreshOnMutation ?? true;

  // Suppressing a poll is only safe while the suppressed tab still gets the data, so dedup without
  // response sharing would just make a tab stop updating. Enforced here rather than documented.
  const isPollingDedupeEnabled =
    (config.dedupePolling ?? true) && syncResponses && transport.isSupported && lockManager.isSupported;

  const mutationFilter = typeof refreshOnMutation === 'object' ? refreshOnMutation.filter : null;

  const broadcast = (event: QueryRepositoryEvent) => {
    if (event.type !== 'request-success' || !event.isMultiTabSyncEnabled) return;

    if (event.isCached) {
      if (!syncResponses) return;

      transport.post({
        type: 'response',
        key: event.key,
        body: event.request.response(),
        expiresAt: event.request.expiresAt(),
      });

      return;
    }

    // Everything else is either a mutation or a read that opted out of the cache. Only the former is
    // worth telling the other tabs about — and an uncacheable read has no shared key to send anyway.
    if (!refreshOnMutation || shouldCacheQuery(event.request.method)) return;

    transport.post({ type: 'mutation', method: event.request.method, url: event.request.url });
  };

  const apply = (message: QuerySyncMessage) => {
    if (message.type === 'response') {
      if (!syncResponses) return;

      repository.applyExternalResponse({ key: message.key, body: message.body, expiresAt: message.expiresAt });

      return;
    }

    if (!refreshOnMutation) return;

    const mutation = { method: message.method, url: message.url };

    repository.refreshInUse(mutationFilter ? (request) => mutationFilter(mutation, request) : undefined);
  };

  const eventSubscription = repository.events$.subscribe(broadcast);
  const unlisten = transport.listen(apply);

  const destroy = () => {
    unlisten();
    eventSubscription.unsubscribe();
    transport.destroy();
  };

  return { isPollingDedupeEnabled, lockManager, destroy };
};
