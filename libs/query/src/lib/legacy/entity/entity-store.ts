import { Observable, Subject, debounceTime, filter, map, shareReplay, startWith } from 'rxjs';
import { EntityKey, EntityStoreConfig } from './entity.types';

class EntityStoreError extends Error {
  constructor(
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'EntityStoreError';
  }
}

function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

export class EntityStore<T> {
  /**
   * @internal
   */
  readonly _dictionary = new Map<EntityKey, T>();

  /**
   * @internal
   */
  readonly _change$ = new Subject<EntityKey | EntityKey[]>();

  constructor(private readonly _config: EntityStoreConfig) {}

  select(key: EntityKey): Observable<T | null>;
  select(keys: EntityKey[]): Observable<T[]>;
  select(keys: EntityKey[][]): Observable<T[]>;
  select(keyOrKeys: EntityKey | EntityKey[] | EntityKey[][]): Observable<T | null> | Observable<T[]> {
    if (Array.isArray(keyOrKeys)) {
      const _keys = this._normalizeKeys(keyOrKeys);
      return this._selectMany(_keys as EntityKey[]);
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
  set(keys: EntityKey[][], values: T[][]): void;
  set(keyOrKeys: EntityKey | EntityKey[] | EntityKey[][], valueOrValues: T | T[] | T[][]) {
    const _keys = this._normalizeKeys(keyOrKeys);

    if (Array.isArray(_keys)) {
      if (!Array.isArray(valueOrValues)) {
        throw new EntityStoreError('When setting multiple keys, values must be an array', {
          keyOrValues: _keys,
          valueOrValues,
        });
      }

      const _values = (Array.isArray(valueOrValues[0]) ? flatten(valueOrValues as T[][]) : valueOrValues) as T[];

      for (let i = 0; i < _keys.length; i++) {
        const k = _keys[i];
        const v = _values[i];

        if (k === undefined || v === undefined) continue;

        this._set(k, v);
      }
    } else {
      this._set(_keys, valueOrValues as T);
    }

    this._change$.next(_keys);
  }

  remove(key: EntityKey): void;
  remove(keys: EntityKey[]): void;
  remove(keys: EntityKey[][]): void;
  remove(keyOrKeys: EntityKey | EntityKey[] | EntityKey[][]) {
    const _keys = this._normalizeKeys(keyOrKeys);

    if (Array.isArray(_keys)) {
      for (const key of _keys) {
        this._remove(key);
      }
    } else {
      this._remove(_keys);
    }

    this._change$.next(_keys);
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

  private _normalizeKeys(keys: EntityKey | EntityKey[] | EntityKey[][]): EntityKey | EntityKey[] {
    if (Array.isArray(keys)) {
      if (Array.isArray(keys[0])) {
        return flatten(keys as EntityKey[][]);
      }

      return keys as EntityKey[];
    }

    return keys;
  }
}
