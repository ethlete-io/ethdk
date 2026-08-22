import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  PLATFORM_ID,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createFakeQueryPersistenceStore,
  FakeQueryPersistenceStoreHandle,
  installFakeBroadcastChannel,
  FakeBroadcastChannelHandle,
} from '@ethlete/query/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuery, Query, QueryArgs } from '../query';
import { withMultiTabSync, withQueryPersistence } from '../query-client-features';
import { createQueryClient, QueryClient, QueryClientRef } from '../query-client';
import { QueryPersistenceConfig } from './query-persistence-config';
import { QueryPersistenceEngine } from './query-persistence-engine';

const DAY = 86_400_000;

type FlushBody = Parameters<TestRequest['flush']>[0];

type MountedQuery = { query: Query<QueryArgs>; destroy: () => void };

describe('query persistence', () => {
  let store: FakeQueryPersistenceStoreHandle;
  let httpTesting: HttpTestingController;
  let parent: EnvironmentInjector;
  let held: TestRequest[] = [];
  let clientCount = 0;

  beforeEach(() => {
    store = createFakeQueryPersistenceStore();
    heldWrites = holdableWrites();
    held = [];

    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    httpTesting = TestBed.inject(HttpTestingController);
    parent = TestBed.inject(EnvironmentInjector);
  });

  /**
   * A session is a query client over the shared fake store. Two of them one after another are what a
   * reload is: same store on disk, everything else built from scratch.
   *
   * Multi-tab sync is off unless a spec asks for it - the two features are independent, and leaving the
   * channel out keeps the event stream to what this spec is about.
   */
  const createSession = (persistence: false | QueryPersistenceConfig = {}) =>
    createQueryClient({
      baseUrl: 'https://api.example.com',
      name: `session-${++clientCount}`,
      features: persistence === false ? [] : [withQueryPersistence({ adapter: store.adapter, ...persistence })],
    });

  const client = (ref: QueryClientRef): QueryClient => TestBed.inject(ref.token);

  const persistenceOf = (ref: QueryClientRef): QueryPersistenceEngine => {
    const engine = client(ref).subtle.persistence;

    if (!engine) throw new Error('Expected the client to have persistence enabled.');

    return engine;
  };

  const mountQuery = (
    ref: QueryClientRef,
    options: { route?: `/${string}`; persistence?: boolean } = {},
  ): MountedQuery => {
    const injector = createEnvironmentInjector([], parent);

    const query = runInInjectionContext(injector, () =>
      createQuery({
        creator: { persistence: options.persistence },
        creatorInternals: { client: ref, method: 'GET', route: options.route ?? '/players' },
        features: [],
        queryConfig: {},
      }),
    );

    return { query, destroy: () => injector.destroy() };
  };

  /** `match()` removes what it matches, so requests are drained into a queue the specs can settle from. */
  const pending = () => {
    held.push(...httpTesting.match(() => true).filter((req) => !req.cancelled));

    return held;
  };

  const flushAll = (body: FlushBody, headers?: Record<string, string>) => {
    for (const req of pending().splice(0)) {
      req.flush(body, headers ? { headers } : undefined);
    }

    TestBed.tick();
  };

  /** Settles the oldest request in flight, leaving any others alone. */
  const flushNext = (body: FlushBody) => {
    const req = pending().shift();

    if (!req) throw new Error('Expected a request to be in flight.');

    req.flush(body);
    TestBed.tick();
  };

  /**
   * Lets the store settle. Reading a body back takes several awaits - the index load, the pruning it
   * may do, then the read itself - and none of them are worth counting in a spec.
   */
  const flushStore = async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
    }
  };

  /**
   * The fake store settles a write on a microtask, which is nowhere near what a real transaction
   * takes. This wraps it so a spec can park one write on disk-arrival and act while it is in flight.
   */
  const holdableWrites = () => {
    let releaseWrite: (() => void) | null = null;
    let onHeld: (() => void) | null = null;
    let isHoldingNext = false;

    return {
      adapter: {
        ...store.adapter,
        write: async (entries: Parameters<typeof store.adapter.write>[0]) => {
          if (isHoldingNext) {
            isHoldingNext = false;

            await new Promise<void>((resolve) => {
              releaseWrite = resolve;
              onHeld?.();
            });
          }

          return await store.adapter.write(entries);
        },
      },
      holdNext: () => (isHoldingNext = true),
      whenHeld: () =>
        new Promise<void>((resolve) => {
          if (releaseWrite) return resolve();

          onHeld = resolve;
        }),
      release: async () => {
        releaseWrite?.();
        releaseWrite = null;
        await flushStore();
      },
    };
  };

  let heldWrites: ReturnType<typeof holdableWrites>;

  /** Ends a session the way a reload does: everything written is on disk, nothing is in memory. */
  const endSession = async (ref: QueryClientRef, mounted?: MountedQuery) => {
    await persistenceOf(ref).flush();
    await flushStore();
    mounted?.destroy();
  };

  describe('hydration', () => {
    it('renders the previous session’s response while revalidating it', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ players: ['ada'] });
      await endSession(first, firstQuery);

      const second = createSession();
      const secondQuery = mountQuery(second);

      // The request went out immediately, as it always does - persisted data never suppresses it.
      expect(pending().length).toBe(1);
      expect(secondQuery.query.response()).toBeNull();

      await flushStore();

      expect(secondQuery.query.response()).toEqual({ players: ['ada'] });
      expect(secondQuery.query.executionState()).toMatchObject({
        type: 'loading',
        hasCachedResponse: true,
        cachedResponse: { players: ['ada'] },
      });

      flushAll({ players: ['ada', 'grace'] });

      expect(secondQuery.query.response()).toEqual({ players: ['ada', 'grace'] });
    });

    it('leaves a response that arrived first alone', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ version: 1 });
      await endSession(first, firstQuery);

      const second = createSession();
      const secondQuery = mountQuery(second);

      // The disk is slower than the network here, which is the common case on a warm connection.
      store.deferReads();
      flushAll({ version: 2 });
      await store.flushReads();
      await flushStore();

      expect(secondQuery.query.response()).toEqual({ version: 2 });
    });

    it('keeps the error of a revalidation that failed', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ players: ['ada'] });
      await endSession(first, firstQuery);

      const second = createSession();
      const secondQuery = mountQuery(second);

      store.deferReads();

      // A 500 rather than a dropped connection: 500 is the one status the default retry policy leaves
      // alone, so the error lands right away instead of after a few backoffs.
      for (const req of pending().splice(0)) {
        req.flush('nope', { status: 500, statusText: 'Server Error' });
      }

      TestBed.tick();
      await store.flushReads();
      await flushStore();

      // Both are true at once, and both matter: there is data to show, and the attempt to refresh it
      // did fail.
      expect(secondQuery.query.response()).toEqual({ players: ['ada'] });
      expect(secondQuery.query.error()).not.toBeNull();
      expect(secondQuery.query.executionState()).toMatchObject({ type: 'failure' });
    });

    it('hydrates an entry that was created before the store finished loading', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ version: 1 });
      await endSession(first, firstQuery);

      // No `flushStore()` between creating the client and mounting the query: the entry exists before
      // the index does, which is what happens on a real cold start.
      const second = createSession();
      const secondQuery = mountQuery(second);

      await flushStore();

      expect(secondQuery.query.response()).toEqual({ version: 1 });
    });

    it('restores freshness, so a later cached execute needs no request', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ version: 1 }, { 'cache-control': 'max-age=600' });
      await endSession(first, firstQuery);

      const second = createSession();
      const secondQuery = mountQuery(second);

      flushAll({ version: 1 }, { 'cache-control': 'max-age=600' });
      await flushStore();

      secondQuery.query.execute({ options: { allowCache: true } });

      expect(pending()).toEqual([]);
    });

    it('ignores a body older than maxAge, and forgets it', async () => {
      const first = createSession();
      const firstQuery = mountQuery(first);

      flushAll({ version: 1 });
      await endSession(first, firstQuery);

      const [stored] = store.entries();
      store.seed([{ ...stored!, persistedAt: Date.now() - 2 * DAY }]);

      const second = createSession({ maxAge: DAY });
      const secondQuery = mountQuery(second);

      await flushStore();

      expect(secondQuery.query.response()).toBeNull();
      expect(store.entries()).toEqual([]);
    });

    it('drops everything written under a different version', async () => {
      const first = createSession({ version: 1 });
      const firstQuery = mountQuery(first);

      flushAll({ version: 1 });
      await endSession(first, firstQuery);

      const second = createSession({ version: 2 });
      const secondQuery = mountQuery(second);

      await flushStore();

      expect(secondQuery.query.response()).toBeNull();
      expect(store.calls().clear).toBe(1);
      expect(store.entries()).toEqual([]);
    });
  });

  describe('writing', () => {
    it('coalesces writes and keeps only the newest body per key', async () => {
      vi.useFakeTimers();

      try {
        const session = createSession({ writeDelay: 1000 });
        const mounted = mountQuery(session);

        flushAll({ version: 1 });
        mounted.query.execute();
        flushAll({ version: 2 });
        mounted.query.execute();
        flushAll({ version: 3 });

        expect(store.calls().write).toBe(0);

        await vi.advanceTimersByTimeAsync(1000);
        await flushStore();

        expect(store.calls().write).toBe(1);
        expect(store.entries().map((entry) => entry.body)).toEqual([{ version: 3 }]);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not persist a mutation', async () => {
      const session = createSession();
      const injector = createEnvironmentInjector([], parent);

      client(session).repository.request({
        consumerDestroyRef: injector.get(DestroyRef),
        method: 'POST',
        route: '/players',
      });

      flushAll({ created: true });
      await endSession(session);

      expect(store.entries()).toEqual([]);
    });

    it('does not persist a query that opted out', async () => {
      const session = createSession();
      const mounted = mountQuery(session, { persistence: false });

      flushAll({ version: 1 });
      await endSession(session, mounted);

      expect(store.entries()).toEqual([]);
    });

    it('does not persist what the client filter rejects', async () => {
      const session = createSession({ filter: ({ url }) => !url.includes('/secrets') });
      const kept = mountQuery(session, { route: '/players' });
      const rejected = mountQuery(session, { route: '/secrets' });

      flushAll({ version: 1 });
      await endSession(session);

      kept.destroy();
      rejected.destroy();

      expect(store.entries().map((entry) => entry.url)).toEqual(['https://api.example.com/players']);
    });

    it('evicts the least recently written entries over maxEntries', async () => {
      const session = createSession({ maxEntries: 2 });

      for (const route of ['/a', '/b', '/c'] as const) {
        const mounted = mountQuery(session, { route });

        flushAll({ route });
        await endSession(session);

        mounted.destroy();
      }

      expect(store.entries().map((entry) => entry.url)).toEqual([
        'https://api.example.com/b',
        'https://api.example.com/c',
      ]);
    });

    it('applies a lowered maxEntries at startup, before anything is written', async () => {
      const first = createSession({ maxEntries: 3 });

      for (const route of ['/a', '/b', '/c'] as const) {
        const mounted = mountQuery(first, { route });

        flushAll({ route });
        await endSession(first);

        mounted.destroy();
      }

      expect(store.entries().length).toBe(3);

      client(createSession({ maxEntries: 1 }));
      await flushStore();

      expect(store.entries().map((entry) => entry.url)).toEqual(['https://api.example.com/c']);
    });

    it('gives up on writing after a second failure, without breaking the client', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const session = createSession();
        const mounted = mountQuery(session);

        store.failNextWrites(2);

        flushAll({ version: 1 });
        await endSession(session);

        expect(store.entries()).toEqual([]);

        // A later settle is simply not written any more - and the query itself is unaffected.
        mounted.query.execute();
        flushAll({ version: 2 });
        await endSession(session, mounted);

        expect(store.entries()).toEqual([]);
        expect(mounted.query.response()).toEqual({ version: 2 });
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('secure responses', () => {
    const requestSecure = (ref: QueryClientRef, options: { persistence?: boolean } = {}) => {
      const injector = createEnvironmentInjector([], parent);

      client(ref).repository.request({
        consumerDestroyRef: injector.get(DestroyRef),
        method: 'GET',
        route: '/me',
        isSecure: true,
        creatorOptions: { persistence: options.persistence },
      });

      return injector;
    };

    it('are not persisted by default', async () => {
      const session = createSession();

      requestSecure(session);
      flushAll({ me: 'ada' });
      await endSession(session);

      expect(store.entries()).toEqual([]);
    });

    it('are persisted when the query opts in', async () => {
      const session = createSession();

      requestSecure(session, { persistence: true });
      flushAll({ me: 'ada' });
      await endSession(session);

      expect(store.entries().map((entry) => entry.isSecure)).toEqual([true]);
    });

    it('are removed from disk on logout, leaving public ones alone', async () => {
      const session = createSession();

      requestSecure(session, { persistence: true });
      const publicQuery = mountQuery(session);

      flushAll({ body: true });
      await endSession(session);

      expect(store.entries().length).toBe(2);

      client(session).repository.unbindAllSecure();
      await flushStore();

      expect(store.entries().map((entry) => entry.isSecure)).toEqual([false]);

      publicQuery.destroy();
    });

    it('are removed from disk on a logout that lands mid-write', async () => {
      const session = createSession({ adapter: heldWrites.adapter });

      requestSecure(session, { persistence: true });
      flushAll({ me: 'ada' });

      // The write is on its way to disk when the logout happens - the window a real store's
      // transaction takes.
      heldWrites.holdNext();
      void persistenceOf(session).flush();
      await heldWrites.whenHeld();

      client(session).repository.unbindAllSecure();

      await heldWrites.release();
      await flushStore();

      expect(store.entries()).toEqual([]);
    });
  });

  describe('with multi-tab sync', () => {
    let bus: FakeBroadcastChannelHandle;

    beforeEach(() => {
      bus = installFakeBroadcastChannel();
    });

    afterEach(() => {
      bus.restore();
    });

    it('only the tab that fetched writes', async () => {
      const channelName = 'persistence-spec';
      const shared = { adapter: store.adapter };

      const tabA = createQueryClient({
        baseUrl: 'https://api.example.com',
        name: 'tab-a',
        features: [withMultiTabSync({ channelName }), withQueryPersistence(shared)],
      });
      const tabB = createQueryClient({
        baseUrl: 'https://api.example.com',
        name: 'tab-b',
        features: [withMultiTabSync({ channelName }), withQueryPersistence(shared)],
      });

      const queryA = mountQuery(tabA);
      const queryB = mountQuery(tabB);

      // Each tab settles its own initial fetch and writes it.
      flushNext({ version: 1 });
      flushNext({ version: 1 });
      await persistenceOf(tabA).flush();
      await persistenceOf(tabB).flush();
      await flushStore();

      const writesSoFar = store.calls().write;

      // Now only tab A refetches. Tab B gets the new body over the channel.
      queryA.query.execute();
      flushNext({ version: 2 });
      await flushStore();

      expect(queryB.query.response()).toEqual({ version: 2 });

      // Applying a shared response is silent, so it produces no repository event - tab B has nothing
      // queued and writes nothing. Only the tab that actually made the request does.
      await persistenceOf(tabB).flush();
      await flushStore();

      expect(store.calls().write).toBe(writesSoFar);

      await persistenceOf(tabA).flush();
      await flushStore();

      expect(store.calls().write).toBe(writesSoFar + 1);
      expect(store.entries().map((entry) => entry.body)).toEqual([{ version: 2 }]);

      queryA.destroy();
      queryB.destroy();
    });
  });

  describe('public API', () => {
    it('clearPersistedQueries empties the store', async () => {
      const session = createSession();
      const mounted = mountQuery(session);

      flushAll({ version: 1 });
      await endSession(session, mounted);

      expect(store.entries().length).toBe(1);

      await client(session).clearPersistedQueries();

      expect(store.entries()).toEqual([]);
    });

    it('clearPersistedQueries empties a store with a write in flight', async () => {
      const session = createSession({ adapter: heldWrites.adapter });
      const mounted = mountQuery(session);

      flushAll({ version: 1 });

      heldWrites.holdNext();
      void persistenceOf(session).flush();
      await heldWrites.whenHeld();

      const cleared = client(session).clearPersistedQueries();

      await heldWrites.release();
      await cleared;
      await flushStore();

      expect(store.entries()).toEqual([]);

      mounted.destroy();
    });

    it('whenPersistenceReady resolves once the index is loaded', async () => {
      const session = createSession();
      let isReady = false;

      void client(session).whenPersistenceReady.then(() => (isReady = true));

      await flushStore();

      expect(isReady).toBe(true);
      expect(store.calls().loadIndex).toBe(1);
    });

    it('survives a store that cannot even be read', async () => {
      store.failNextLoadIndex();

      const session = createSession();
      const mounted = mountQuery(session);

      flushAll({ version: 1 });
      await endSession(session, mounted);

      expect(mounted.query.response()).toEqual({ version: 1 });

      // Writing is not given up on just because reading failed - those can fail independently.
      expect(store.entries().length).toBe(1);
    });
  });

  describe('turned off', () => {
    it('touches no store when persistence is false', async () => {
      const session = createSession(false);
      const mounted = mountQuery(session);

      flushAll({ version: 1 });
      await flushStore();

      expect(client(session).subtle.persistence).toBeNull();
      expect(store.calls()).toMatchObject({ loadIndex: 0, read: 0, write: 0 });

      mounted.destroy();
    });

    it('is inert on the server', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'server' }],
      });

      const session = createQueryClient({
        baseUrl: 'https://api.example.com',
        name: 'ssr',
        features: [withQueryPersistence({ adapter: store.adapter })],
      });
      const ssrClient = TestBed.inject(session.token);

      expect(ssrClient.subtle.persistence).toBeNull();

      await ssrClient.whenPersistenceReady;
      await flushStore();

      expect(store.calls()).toMatchObject({ loadIndex: 0, read: 0, write: 0 });
    });
  });
});
