import { afterEach, describe, expect, it } from 'vitest';
import { createIndexedDbQueryPersistenceAdapter } from './query-persistence-indexed-db';

type FakeOpenRequest = {
  result: unknown;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onblocked: (() => void) | null;
  onupgradeneeded: (() => void) | null;
};

type FakeDatabase = {
  objectStoreNames: string[];
  onversionchange: (() => void) | null;
  closeCount: number;
  stores: Map<string, Map<string, Record<string, unknown>>>;
};

const opened: FakeOpenRequest[] = [];
let indexedDbDescriptor: PropertyDescriptor | undefined;

/**
 * jsdom ships no IndexedDB, so the adapter is driven against a hand-rolled `open` whose request is
 * answered by the test: every claim of this file is about which callback arrives when.
 */
const installFakeIndexedDb = () => {
  indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open: () => {
        const request: FakeOpenRequest = {
          result: null,
          error: null,
          onsuccess: null,
          onerror: null,
          onblocked: null,
          onupgradeneeded: null,
        };

        opened.push(request);

        return request as unknown as IDBOpenDBRequest;
      },
    },
  });
};

const createFakeDatabase = (): FakeDatabase => {
  const stores = new Map<string, Map<string, Record<string, unknown>>>();

  return {
    objectStoreNames: [],
    onversionchange: null,
    closeCount: 0,
    stores,
  };
};

/** Answers an open request with a database whose stores behave, plus transactions that complete. */
const connect = (request: FakeOpenRequest, database = createFakeDatabase()) => {
  const objectStore = (name: string) => {
    const records = database.stores.get(name) ?? new Map<string, Record<string, unknown>>();
    database.stores.set(name, records);

    return records;
  };

  const answer = <T>(result: T) => {
    const pending = { result, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T> & {
      onsuccess: (() => void) | null;
    };

    queueMicrotask(() => pending.onsuccess?.(new Event('success') as never));

    return pending;
  };

  request.result = {
    close: () => database.closeCount++,
    get onversionchange() {
      return database.onversionchange;
    },
    set onversionchange(handler: (() => void) | null) {
      database.onversionchange = handler;
    },
    objectStoreNames: database.objectStoreNames,
    deleteObjectStore: (name: string) => database.stores.delete(name),
    createObjectStore: (name: string) => database.stores.set(name, new Map()),
    transaction: (names: string | string[]) => {
      const transaction = {
        oncomplete: null as (() => void) | null,
        onerror: null,
        onabort: null,
        objectStore: (name: string) => ({
          getAll: () => answer(Array.from(objectStore(name).values())),
          get: (key: string) => answer(objectStore(name).get(key)),
          put: (record: Record<string, unknown>) => objectStore(name).set(record['key'] as string, record),
          delete: (key: string) => objectStore(name).delete(key),
          clear: () => objectStore(name).clear(),
        }),
      };

      void names;
      queueMicrotask(() => queueMicrotask(() => transaction.oncomplete?.()));

      return transaction;
    },
  };

  request.onsuccess?.();

  return database;
};

describe('the IndexedDB persistence adapter', () => {
  afterEach(() => {
    opened.length = 0;
    Reflect.deleteProperty(globalThis, 'indexedDB');
    if (indexedDbDescriptor) Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
  });

  it('opens the database again after a failed open, instead of giving up for the session', async () => {
    installFakeIndexedDb();

    const adapter = createIndexedDbQueryPersistenceAdapter({ storageName: 'et-query-persistence-retry' });

    const first = adapter.loadIndex();
    opened[0]!.error = new Error('storage denied');
    opened[0]!.onerror?.();

    await expect(first).rejects.toThrow('storage denied');

    const second = adapter.loadIndex();

    expect(opened).toHaveLength(2);

    connect(opened[1]!);

    await expect(second).resolves.toEqual([]);
  });

  it('closes a connection that arrives after the open was rejected as blocked', async () => {
    installFakeIndexedDb();

    const adapter = createIndexedDbQueryPersistenceAdapter({ storageName: 'et-query-persistence-blocked' });

    const blocked = adapter.loadIndex();
    opened[0]!.onblocked?.();

    await expect(blocked).rejects.toThrow(/blocked by another tab/);

    const database = connect(opened[0]!);

    expect(database.closeCount).toBe(1);
    expect(database.onversionchange).toBeNull();
  });

  it('keeps bodies out of the index read and hands one back per key', async () => {
    installFakeIndexedDb();

    const adapter = createIndexedDbQueryPersistenceAdapter({ storageName: 'et-query-persistence-round-trip' });

    const written = adapter.write([
      {
        key: 'a',
        url: 'https://api.test/a',
        method: 'GET',
        isSecure: false,
        version: 1,
        persistedAt: 1,
        expiresAt: null,
        body: { a: 1 },
      },
    ]);

    connect(opened[0]!);
    await written;

    await expect(adapter.loadIndex()).resolves.toEqual([
      {
        key: 'a',
        url: 'https://api.test/a',
        method: 'GET',
        isSecure: false,
        version: 1,
        persistedAt: 1,
        expiresAt: null,
      },
    ]);
    await expect(adapter.read('a')).resolves.toEqual({ body: { a: 1 } });
    await expect(adapter.read('missing')).resolves.toBeNull();

    await adapter.remove(['a']);

    await expect(adapter.loadIndex()).resolves.toEqual([]);
  });
});
