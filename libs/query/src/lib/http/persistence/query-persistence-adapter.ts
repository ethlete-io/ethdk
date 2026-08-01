import { QueryKey } from '../query-repository';
import { PersistedQueryBody, PersistedQueryEntry, PersistedQueryEntryMeta } from './persisted-query-entry';

/**
 * Where a query client keeps its persisted responses. The default is IndexedDB
 * ({@link createIndexedDbQueryPersistenceAdapter}); an app can supply its own to store responses
 * somewhere else entirely - `localStorage`, the origin private file system, a native store behind a
 * Capacitor plugin.
 *
 * Adapters are deliberately dumb: they read and write what they are handed and nothing else. Every
 * policy decision - how old a body may be, how many are kept, what happens on a logout - is made by
 * the persistence engine, so a custom adapter cannot get any of it subtly wrong.
 *
 * Every method may reject. The engine treats a failing read as a miss and a failing write as a full
 * disk (it prunes and retries once, then stops writing for the session), so an adapter never needs to
 * swallow its own errors.
 */
export type QueryPersistenceAdapter = {
  /**
   * Returns the metadata of every entry in the store, without their bodies. Called once per client,
   * at startup - the one bulk read there is.
   */
  loadIndex: () => Promise<PersistedQueryEntryMeta[]>;

  /** Reads a single body back, or `null` when the store does not hold that key. */
  read: (key: QueryKey) => Promise<PersistedQueryBody | null>;

  /**
   * Writes entries, replacing any it already holds under the same key. Called with a batch, since the
   * engine coalesces writes - an adapter backed by transactions should use one for the whole batch.
   */
  write: (entries: PersistedQueryEntry[]) => Promise<void>;

  /** Removes entries by key. Keys the store does not hold are ignored, not an error. */
  remove: (keys: QueryKey[]) => Promise<void>;

  /** Empties the store. */
  clear: () => Promise<void>;

  /**
   * Whether the underlying storage exists in this environment. `false` means every method is an inert
   * no-op - no IndexedDB (the server, or a browser denying storage access), in which case queries
   * behave exactly as they do without persistence.
   */
  isSupported: boolean;
};

const resolveEmptyIndex = () => Promise.resolve<PersistedQueryEntryMeta[]>([]);
const resolveNull = () => Promise.resolve(null);
const resolveVoid = () => Promise.resolve();

/**
 * An adapter that stores nothing, for environments without storage. Kept as a real adapter rather
 * than a `null` the engine has to check for, so there is only one code path.
 */
export const createNoopQueryPersistenceAdapter = (): QueryPersistenceAdapter => ({
  loadIndex: resolveEmptyIndex,
  read: resolveNull,
  write: resolveVoid,
  remove: resolveVoid,
  clear: resolveVoid,
  isSupported: false,
});
