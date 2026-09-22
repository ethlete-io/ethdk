import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, DestroyRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createFakeQueryPersistenceStore,
  FakeBroadcastChannelHandle,
  installFakeBroadcastChannel,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryDevtoolsFeatureDetail } from '../devtools/query-devtools-features';
import { createQueryClient } from './query-client';
import {
  QueryClientFeature,
  QueryClientFeatureFn,
  withMultiTabSync,
  withQueryPersistence,
} from './query-client-features';
import { QueryPersistenceEngine } from './persistence/query-persistence-engine';

describe('query client features', () => {
  let injector: EnvironmentInjector;
  let broadcast: FakeBroadcastChannelHandle;

  beforeEach(() => {
    broadcast = installFakeBroadcastChannel();

    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  });

  afterEach(() => {
    if (!injector.destroyed) injector.destroy();

    broadcast.restore();
  });

  const install = (featureFn: QueryClientFeatureFn): QueryClientFeature => {
    const client = TestBed.inject(createQueryClient({ baseUrl: 'https://api.test', name: 'bare' }).token);

    return featureFn({
      clientName: 'features-spec',
      repository: client.repository,
      destroyRef: injector.get(DestroyRef),
      isBrowser: true,
    });
  };

  const detailsOf = (feature: QueryClientFeature): QueryDevtoolsFeatureDetail[] =>
    'devtools' in feature && feature.devtools ? feature.devtools() : [];

  const valueOf = (feature: QueryClientFeature, label: string) =>
    detailsOf(feature).find((detail) => detail.label === label)?.value;

  describe('withMultiTabSync devtools', () => {
    it('describes the defaults: a per-client channel sharing, deduping and refreshing everything in use', () => {
      expect(detailsOf(install(withMultiTabSync()))).toEqual([
        { label: 'channel', value: 'et-query-sync-features-spec' },
        { label: 'share responses', value: 'yes' },
        { label: 'dedupe polling', value: 'yes' },
        { label: 'refresh on mutation', value: 'every query in use' },
      ]);
    });

    it('describes every option turned off', () => {
      const feature = install(
        withMultiTabSync({
          channelName: 'shared',
          syncResponses: false,
          dedupePolling: false,
          refreshOnMutation: false,
        }),
      );

      expect(detailsOf(feature)).toEqual([
        { label: 'channel', value: 'shared' },
        { label: 'share responses', value: 'no' },
        { label: 'dedupe polling', value: 'no' },
        { label: 'refresh on mutation', value: 'no' },
      ]);
    });

    it.each([
      [true, 'every query in use'],
      [{ filter: () => true }, 'filtered'],
    ] as const)('describes refreshOnMutation %o as %s', (refreshOnMutation, expected) => {
      expect(valueOf(install(withMultiTabSync({ refreshOnMutation })), 'refresh on mutation')).toBe(expected);
    });
  });

  describe('withQueryPersistence devtools', () => {
    it('describes the defaults: a per-client IndexedDB store, version 1, one day, 50 entries, a 1s write delay', () => {
      expect(detailsOf(install(withQueryPersistence()))).toEqual([
        { label: 'store', value: 'et-query-persistence-features-spec' },
        { label: 'version', value: '1' },
        { label: 'max age', value: '24h' },
        { label: 'max entries', value: '50' },
        { label: 'write delay', value: '1s' },
      ]);
    });

    it('describes a configured store, including a custom adapter and a named filter', () => {
      const store = createFakeQueryPersistenceStore();
      const onlyPlayers = () => true;

      const feature = install(
        withQueryPersistence({
          storageName: 'my-store',
          version: 4,
          maxAge: 90 * 60_000,
          maxEntries: 10,
          writeDelay: 250,
          adapter: () => store.adapter,
          filter: onlyPlayers,
        }),
      );

      expect(detailsOf(feature)).toEqual([
        { label: 'store', value: 'my-store' },
        { label: 'version', value: '4' },
        { label: 'max age', value: '1.5h' },
        { label: 'max entries', value: '10' },
        { label: 'write delay', value: '250ms' },
        { label: 'adapter', value: 'custom' },
        { label: 'filter', value: 'onlyPlayers' },
      ]);
    });
  });

  describe('withQueryPersistence flushing', () => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    afterEach(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });

    const installEngine = () => {
      const store = createFakeQueryPersistenceStore();
      const engine = install(withQueryPersistence({ adapter: store.adapter })).instance as QueryPersistenceEngine;

      return vi.spyOn(engine, 'flush');
    };

    it('flushes when the tab is hidden, not when it becomes visible again', () => {
      const flush = installEngine();

      setVisibility('visible');
      expect(flush).not.toHaveBeenCalled();

      setVisibility('hidden');
      expect(flush).toHaveBeenCalledTimes(1);
    });

    it('flushes on pagehide', () => {
      const flush = installEngine();

      window.dispatchEvent(new Event('pagehide'));

      expect(flush).toHaveBeenCalledTimes(1);
    });

    it('stops listening once the client is destroyed', () => {
      const flush = installEngine();

      injector.destroy();
      setVisibility('hidden');
      window.dispatchEvent(new Event('pagehide'));

      expect(flush).not.toHaveBeenCalled();
    });
  });
});
