import { signal } from '@angular/core';
import { createFakeQueryPersistenceStore, FakeQueryPersistenceStoreHandle } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoopQueryPersistenceAdapter, QueryPersistenceAdapter, withArgs, withQueryPersistence } from '../index';
import { useScenario } from './harness';

let store: FakeQueryPersistenceStoreHandle;
let hasStorageConsent = false;
let noopWrites: ReturnType<typeof vi.fn>;

const consentAwareAdapter = (): QueryPersistenceAdapter => {
  if (hasStorageConsent) return store.adapter;

  const noop = createNoopQueryPersistenceAdapter();
  noopWrites = vi.fn(noop.write);

  return { ...noop, write: noopWrites as QueryPersistenceAdapter['write'] };
};

describe('createNoopQueryPersistenceAdapter as the adapter an app passes without storage consent', () => {
  beforeEach(() => {
    store = createFakeQueryPersistenceStore();
  });

  describe('without consent', () => {
    beforeEach(() => {
      hasStorageConsent = false;
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: consentAwareAdapter })],
    });

    it('fetches per args change as usual and writes nothing to disk', async () => {
      const s = scenario();
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 50 }));

      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);
      const id = signal('1');
      const c = s.consumer();
      const query = c.run(() => getTeam(withArgs(() => ({ pathParams: { id: id() } }))));

      await s.settle(1000);
      expect(query.response()).toEqual({ id: '1' });

      for (const next of ['2', '3', '4']) {
        id.set(next);
        await s.settle(1000);

        expect(query.response()).toEqual({ id: next });
        expect(s.api.requestCount('GET', `/teams/${next}`)).toBe(1);
      }

      await s.client.subtle.persistence?.flush();
      expect(noopWrites).not.toHaveBeenCalled();
      expect(store.entries().length).toBe(0);

      c.destroy();
    });
  });

  describe('after consent, on the next load', () => {
    beforeEach(() => {
      hasStorageConsent = true;
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withQueryPersistence({ adapter: consentAwareAdapter })],
    });

    it('persists through the real adapter instead', async () => {
      const s = scenario();
      s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 50 }));

      const getTeam = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/teams/${p.id}`);
      const c = s.consumer();
      const query = c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '1' } }))));

      await s.settle(1000);
      expect(query.response()).toEqual({ id: '1' });
      await s.client.subtle.persistence?.flush();
      expect(store.entries().length).toBe(1);

      c.destroy();
    });
  });
});
