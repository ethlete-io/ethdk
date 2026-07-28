import { deserializeTableState, serializeTableState } from './table-state-url';
import { TableState } from '../table.types';

/** Where a persisted {@link TableState} is kept. Both are per-origin; `'session'` dies with the tab. */
export type TableStateStorageKind = 'local' | 'session';

export type TableStateStorageOptions = {
  /**
   * The storage key. Namespace it per table *and* per meaning — `'users-table'`, not `'table'` — since
   * restoring one table's column order into another is worse than not restoring at all.
   */
  key: string;
  /** `'local'` survives a browser restart, `'session'` the tab only. @default 'local' */
  kind?: TableStateStorageKind;
  /**
   * The store to use. Defaults to `window.localStorage` / `window.sessionStorage`, and falls back to a
   * no-op when neither exists (SSR, or a browser with storage blocked) — persistence is a convenience,
   * never a reason for a table to fail to render.
   */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
};

/** A store that reads and writes nothing — SSR, or a browser that refuses storage. */
const NOOP_STORAGE: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const resolveStorage = (options: TableStateStorageOptions) => {
  if (options.storage !== undefined) return options.storage ?? NOOP_STORAGE;

  try {
    const storage = options.kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;

    return storage ?? NOOP_STORAGE;
  } catch {
    // Access itself throws when cookies/storage are blocked, before any read.
    return NOOP_STORAGE;
  }
};

/**
 * A `localStorage` / `sessionStorage` store for a table's {@link TableState} — the same serialized form
 * {@link serializeTableState} produces for URLs, so a link and a stored setup are interchangeable.
 *
 * Every operation swallows its own failure (a full quota, private-mode restrictions, a hand-edited
 * value): a table that can't remember its columns still has to show them.
 *
 * @example
 * const store = createTableStateStorage({ key: 'users-table' });
 *
 * // restore once, then save on change
 * const state = store.load();
 * if (state) table.restoreState(state);
 * effect(() => store.save(table.state()));
 */
export const createTableStateStorage = (options: TableStateStorageOptions) => {
  const storage = resolveStorage(options);

  return {
    /** The stored state, or `null` when there is none (or it is unreadable — see `deserializeTableState`). */
    load: (): TableState | null => {
      try {
        return deserializeTableState(storage.getItem(options.key));
      } catch {
        return null;
      }
    },

    /** Store a state. Silently does nothing when the store rejects the write. */
    save: (state: TableState) => {
      try {
        storage.setItem(options.key, serializeTableState(state));
      } catch {
        // quota, private mode, disabled storage — nothing to do about it here
      }
    },

    /** Forget the stored state, so the table starts from its column definitions again. */
    clear: () => {
      try {
        storage.removeItem(options.key);
      } catch {
        // see save()
      }
    },
  };
};

export type TableStateStorage = ReturnType<typeof createTableStateStorage>;
