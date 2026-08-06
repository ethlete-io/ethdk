import { registerQueryDevtoolsEntry } from './query-devtools-hook';
import { clearQueryDevtoolsTombstones, provideQueryDevtools, queryDevtoolsEntries } from './query-devtools-registry';
import { MAX_QUERY_DEVTOOLS_TOMBSTONES, snapshotQueryDevtoolsHandle } from './query-devtools-tombstone';

/** A query as the panel reads one: the signals it touches, and the request behind them. */
const fakeQuery = (overrides: { response?: unknown; error?: unknown; url?: string } = {}) => {
  const request = {
    method: 'PUT',
    url: overrides.url ?? 'https://example.com/post/1',
    args: { body: { title: 'x' } },
    loading: () => null,
    error: () => overrides.error ?? null,
    response: () => overrides.response ?? null,
    currentEvent: () => null,
    expiresAt: () => null,
    subtle: {
      retryState: () => ({ attempt: 2, delayMs: 1000, startsAt: 5, status: 503 }),
      attempts: () => 3,
      lastDurationMs: () => 42,
      resolveHeaders: () => undefined,
      lastPersistedResponseAt: () => null,
      lastExternalResponseAt: () => null,
    },
  };

  return {
    id: () => 'key-1',
    args: () => ({ body: { title: 'x' } }),
    response: () => overrides.response ?? null,
    error: () => overrides.error ?? null,
    latestHttpEvent: () => null,
    loading: () => ({ progress: null }),
    lastTimeExecutedAt: () => 1234,
    triggeredBy: () => null,
    executionState: () => ({ type: 'failure' }),
    execute: () => true,
    reset: () => undefined,
    subtle: { request: () => request },
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (value: unknown) => value as any;

const registerQuery = (route: string, handle: unknown) =>
  registerQueryDevtoolsEntry({
    kind: 'query',
    handle,
    meta: { method: 'PUT', element: document.createElement('div') },
    route,
  });

describe('query devtools tombstones', () => {
  beforeAll(() => provideQueryDevtools());

  afterEach(() => clearQueryDevtoolsTombstones());

  describe('snapshotQueryDevtoolsHandle', () => {
    it('should answer with what the query last held, through the same shape the panel reads', () => {
      const snapshot = asAny(snapshotQueryDevtoolsHandle(fakeQuery({ error: { status: 401 } })));

      expect(snapshot.id()).toBe('key-1');
      expect(snapshot.error()).toEqual({ status: 401 });
      expect(snapshot.lastTimeExecutedAt()).toBe(1234);
      expect(snapshot.executionState()).toEqual({ type: 'failure' });
      expect(snapshot.subtle.request().url).toBe('https://example.com/post/1');
      expect(snapshot.subtle.request().subtle.attempts()).toBe(3);
      expect(snapshot.subtle.request().subtle.lastDurationMs()).toBe(42);
    });

    it('should never report loading, retrying or staleness - a frozen request settles nothing', () => {
      const snapshot = asAny(snapshotQueryDevtoolsHandle(fakeQuery()));

      expect(snapshot.loading()).toBeNull();
      expect(snapshot.subtle.request().loading()).toBeNull();
      expect(snapshot.subtle.request().isStale()).toBe(false);
      expect(snapshot.subtle.request().subtle.retryState()).toBeNull();
    });

    it('should make every action inert', () => {
      const query = fakeQuery();
      const snapshot = asAny(snapshotQueryDevtoolsHandle(query));

      expect(snapshot.execute()).toBe(false);
      expect(snapshot.subtle.request().execute()).toBe(false);
      expect(() => {
        snapshot.reset();
        snapshot.subtle.setResponse({});
      }).not.toThrow();
    });

    it('should copy the request rather than hold it, so identity matching cannot resolve to a dead one', () => {
      const query = fakeQuery();
      const snapshot = asAny(snapshotQueryDevtoolsHandle(query));

      expect(snapshot.subtle.request()).not.toBe(query.subtle.request());
    });

    it('should keep whatever it can read when the query throws on the way out', () => {
      const snapshot = asAny(
        snapshotQueryDevtoolsHandle({
          ...fakeQuery(),
          response: () => {
            throw new Error('injector destroyed');
          },
        }),
      );

      expect(snapshot.response()).toBeNull();
      expect(snapshot.id()).toBe('key-1');
    });
  });

  describe('the registry', () => {
    it('should keep a destroyed query as a tombstone instead of dropping it', () => {
      const unregister = registerQuery('/post/1', fakeQuery({ error: { status: 401 } }));
      unregister();

      const entry = queryDevtoolsEntries().find((e) => e.meta.route === '/post/1');

      expect(entry?.destroyedAt).toBeTypeOf('number');
      expect(asAny(entry?.handle).error()).toEqual({ status: 401 });
    });

    it('should drop the host element, which the tombstone would otherwise keep alive', () => {
      const unregister = registerQuery('/post/2', fakeQuery());
      unregister();

      expect(queryDevtoolsEntries().find((e) => e.meta.route === '/post/2')?.meta.element).toBeUndefined();
    });

    it('should not tombstone anything but a query', () => {
      const unregister = registerQueryDevtoolsEntry({ kind: 'query-stack', handle: {}, meta: { name: 'stack' } });
      unregister();

      expect(queryDevtoolsEntries().some((e) => e.meta.name === 'stack')).toBe(false);
    });

    it('should cap the tombstones it keeps, dropping the oldest first', () => {
      for (let i = 0; i < MAX_QUERY_DEVTOOLS_TOMBSTONES + 5; i++) {
        registerQuery(`/capped/${i}`, fakeQuery())();
      }

      const kept = queryDevtoolsEntries().filter((e) => e.destroyedAt);

      expect(kept).toHaveLength(MAX_QUERY_DEVTOOLS_TOMBSTONES);
      expect(kept.some((e) => e.meta.route === '/capped/0')).toBe(false);
      expect(kept.some((e) => e.meta.route === `/capped/${MAX_QUERY_DEVTOOLS_TOMBSTONES + 4}`)).toBe(true);
    });

    it('should clear every tombstone and leave the live entries alone', () => {
      const live = registerQuery('/live', fakeQuery());
      registerQuery('/gone', fakeQuery())();

      clearQueryDevtoolsTombstones();

      expect(queryDevtoolsEntries().some((e) => e.meta.route === '/gone')).toBe(false);
      expect(queryDevtoolsEntries().some((e) => e.meta.route === '/live')).toBe(true);

      live();
    });

    it('should let a re-registration under the same id replace the tombstone it left', () => {
      const id = 'explicit-id';
      const register = () =>
        registerQueryDevtoolsEntry({ id, kind: 'query', handle: fakeQuery(), meta: { method: 'GET' } });

      register()();
      const live = register();

      const matches = queryDevtoolsEntries().filter((e) => e.id === id);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.destroyedAt).toBeUndefined();

      live();
    });
  });
});
