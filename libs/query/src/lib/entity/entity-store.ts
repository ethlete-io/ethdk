import { Observable, Subject, debounceTime, filter, map, shareReplay, startWith } from 'rxjs';
import { EntityKey, EntityStoreConfig } from './entity.types';

class EntityStoreError extends Error {
  constructor(message: string, public detail?: unknown) {
    super(message);
    this.name = 'EntityStoreError';
  }
}

export class EntityStore<T> {
  private readonly _dictionary = new Map<EntityKey, T>();

  private readonly _change$ = new Subject<EntityKey | EntityKey[]>();

  constructor(private readonly _config: EntityStoreConfig) {}

  select(key: EntityKey): Observable<T | null>;
  select(keys: EntityKey[]): Observable<T[]>;
  select(keyOrKeys: EntityKey | EntityKey[]): Observable<T | null> | Observable<T[]> {
    if (Array.isArray(keyOrKeys)) {
      return this._selectMany(keyOrKeys);
    }

    return this._select(keyOrKeys);
  }

  /**
   * **Note:** Prefer `select` over `selectWhere` when possible.
   */
  selectWhere(predicate: (value: T) => boolean): Observable<T[]> {
    return this._change$.pipe(
      startWith(null),
      debounceTime(0),
      map(() => Array.from(this._dictionary.values()).filter(predicate)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  set(key: EntityKey, value: T): void;
  set(keys: EntityKey[], values: T[]): void;
  set(keyOrKeys: EntityKey | EntityKey[], valueOrValues: T | T[]) {
    if (Array.isArray(keyOrKeys)) {
      if (!Array.isArray(valueOrValues)) {
        throw new EntityStoreError('When setting multiple keys, values must be an array', {
          keyOrValues: keyOrKeys,
          valueOrValues,
        });
      }

      for (let i = 0; i < keyOrKeys.length; i++) {
        this._set(keyOrKeys[i], valueOrValues[i]);
      }
    } else {
      this._set(keyOrKeys, valueOrValues as T);
    }

    this._change$.next(keyOrKeys);
  }

  remove(key: EntityKey): void;
  remove(keys: EntityKey[]): void;
  remove(keyOrKeys: EntityKey | EntityKey[]) {
    if (Array.isArray(keyOrKeys)) {
      for (const key of keyOrKeys) {
        this._remove(key);
      }
    } else {
      this._remove(keyOrKeys);
    }

    this._change$.next(keyOrKeys);
  }

  logState() {
    console.log('EntityStore:', this._config.name, {
      dictionary: this._dictionary,
    });
  }

  private _select(key: EntityKey): Observable<T | null> {
    if (this._config.logActions) {
      console.log('EntityStore: select', this._config.name, key);
    }

    return this._change$.pipe(
      startWith(null),
      filter((v) => {
        if (v === null) {
          return true;
        }

        if (Array.isArray(v)) {
          return v.includes(key);
        }

        return v === key;
      }),
      map(() => this._dictionary.get(key) ?? null),
    );
  }

  private _selectMany(keys: EntityKey[]): Observable<T[]> {
    if (this._config.logActions) {
      console.log('EntityStore: selectMany', this._config.name, keys);
    }

    return this._change$.pipe(
      startWith(null),
      filter((v) => {
        if (v === null) {
          return true;
        }

        if (Array.isArray(v)) {
          return keys.some((key) => v.includes(key));
        }

        return keys.includes(v);
      }),
      map(() => keys.map((key) => this._dictionary.get(key)).filter((value): value is T => value !== undefined)),
    );
  }

  private _set(key: EntityKey, value: T) {
    if (this._config.logActions) {
      console.log('EntityStore: set', this._config.name, key, value);
    }

    this._dictionary.set(key, value);
  }

  private _remove(key: EntityKey) {
    if (this._config.logActions) {
      console.log('EntityStore: remove', this._config.name, key);
    }

    this._dictionary.delete(key);
  }
}
