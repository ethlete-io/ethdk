import { QueryKey } from '../query-repository';
import {
  PersistedQueryBody,
  PersistedQueryEntry,
  PersistedQueryEntryMeta,
  QUERY_PERSISTENCE_STORE_VERSION,
} from './persisted-query-entry';
import { createNoopQueryPersistenceAdapter, QueryPersistenceAdapter } from './query-persistence-adapter';

/**
 * Metadata and bodies are two object stores rather than one: the engine reads *all* of the metadata at
 * startup and a body only when a query actually asks for it, so keeping them apart means the startup
 * read never deserializes a single response.
 */
const META_STORE = 'meta';
const BODY_STORE = 'bodies';

type PersistedBodyRecord = {
  key: QueryKey;
  body: unknown;
};

const toPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Resolves when every write in the transaction is durable. Waiting on the transaction rather than on
 * the individual requests is what surfaces a full disk: a `QuotaExceededError` aborts the whole
 * transaction, which is exactly the signal the engine acts on.
 */
const whenComplete = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export type CreateIndexedDbQueryPersistenceAdapterOptions = {
  /** The name of the IndexedDB database. One per query client. */
  storageName: string;
};

/**
 * The default storage backend for the {@link withQueryPersistence} feature: an IndexedDB
 * database per query client.
 *
 * IndexedDB rather than `localStorage` because it stores structured clones - no serialization pass,
 * and no new constraint on what a response body may contain beyond the one multi-tab sync already
 * imposes - and because response bodies are far too large for a 5MB quota shared with everything else
 * on the origin.
 */
export const createIndexedDbQueryPersistenceAdapter = (
  options: CreateIndexedDbQueryPersistenceAdapterOptions,
): QueryPersistenceAdapter => {
  if (typeof indexedDB === 'undefined') return createNoopQueryPersistenceAdapter();

  let databasePromise: Promise<IDBDatabase> | null = null;

  const openDatabase = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open(options.storageName, QUERY_PERSISTENCE_STORE_VERSION);

      let hasFailed = false;

      // Forgetting the promise is what makes a transient failure - storage denied while a prompt was
      // up, another tab mid-upgrade - recoverable: without it one bad open disables persistence for
      // the rest of the session.
      const fail = (error: unknown) => {
        hasFailed = true;
        databasePromise = null;

        reject(error);
      };

      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;

        // Nothing is migrated on a schema change. The store is a cache of things the server can hand
        // out again, so dropping it costs one request per query and keeps the upgrade path a line long.
        for (const storeName of Array.from(database.objectStoreNames)) {
          database.deleteObjectStore(storeName);
        }

        database.createObjectStore(META_STORE, { keyPath: 'key' });
        database.createObjectStore(BODY_STORE, { keyPath: 'key' });
      };

      openRequest.onsuccess = () => {
        const database = openRequest.result;

        // The open was already rejected, so nobody holds this connection - and an open connection with
        // no `onversionchange` handler blocks every future upgrade from every tab until the page goes.
        if (hasFailed) {
          database.close();

          return;
        }

        // A tab running a newer deploy needs every older connection to go away before it can upgrade
        // the schema. Closing on demand - and forgetting the connection, so the next call reopens -
        // keeps this tab from blocking it indefinitely.
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };

        resolve(database);
      };

      openRequest.onerror = () => fail(openRequest.error);

      // The mirror image of the above: another tab is holding a connection open and not letting go, so
      // this upgrade would hang. Failing fast degrades to "no persistence in this tab" instead.
      openRequest.onblocked = () =>
        fail(new Error(`[@ethlete/query] Opening "${options.storageName}" was blocked by another tab.`));
    });

  const database = () => (databasePromise ??= openDatabase());

  const loadIndex = async () => {
    const db = await database();
    const transaction = db.transaction(META_STORE, 'readonly');

    return await toPromise(transaction.objectStore(META_STORE).getAll() as IDBRequest<PersistedQueryEntryMeta[]>);
  };

  const read = async (key: QueryKey): Promise<PersistedQueryBody | null> => {
    const db = await database();
    const transaction = db.transaction(BODY_STORE, 'readonly');
    const record = await toPromise(
      transaction.objectStore(BODY_STORE).get(key) as IDBRequest<PersistedBodyRecord | undefined>,
    );

    return record ? { body: record.body } : null;
  };

  const write = async (entries: PersistedQueryEntry[]) => {
    if (!entries.length) return;

    const db = await database();
    const transaction = db.transaction([META_STORE, BODY_STORE], 'readwrite');
    const meta = transaction.objectStore(META_STORE);
    const bodies = transaction.objectStore(BODY_STORE);

    for (const { body, ...entryMeta } of entries) {
      meta.put(entryMeta);
      bodies.put({ key: entryMeta.key, body } satisfies PersistedBodyRecord);
    }

    await whenComplete(transaction);
  };

  const remove = async (keys: QueryKey[]) => {
    if (!keys.length) return;

    const db = await database();
    const transaction = db.transaction([META_STORE, BODY_STORE], 'readwrite');
    const meta = transaction.objectStore(META_STORE);
    const bodies = transaction.objectStore(BODY_STORE);

    for (const key of keys) {
      meta.delete(key);
      bodies.delete(key);
    }

    await whenComplete(transaction);
  };

  const clear = async () => {
    const db = await database();
    const transaction = db.transaction([META_STORE, BODY_STORE], 'readwrite');

    transaction.objectStore(META_STORE).clear();
    transaction.objectStore(BODY_STORE).clear();

    await whenComplete(transaction);
  };

  return { loadIndex, read, write, remove, clear, isSupported: true };
};
