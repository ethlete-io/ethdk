import { debounceTime, map, startWith, Subject } from 'rxjs';
import { EntityKey, EntityStoreActionResult, EntityStoreConfig } from './entity.types';

export class EntityStore<T> {
  private readonly _dictionary = new Map<EntityKey, T>();
  private readonly _keys = new Set<EntityKey>();

  private readonly _events$ = new Subject<EntityStoreActionResult>();

  get events$() {
    return this._events$.asObservable();
  }

  get keys() {
    return [...this._keys];
  }

  get values() {
    return [...this._dictionary.values()];
  }

  get size() {
    return this._keys.size;
  }

  get isEmpty() {
    return this.size === 0;
  }

  get config() {
    return this._config;
  }

  get idKey() {
    return this._config.idKey || 'id';
  }

  readonly entities$ = this.events$.pipe(
    startWith(null),
    debounceTime(0),
    map(() => ({
      keys: this.keys,
      values: this.values,
    })),
  );

  constructor(private readonly _config: EntityStoreConfig) {}

  getOne(key: EntityKey) {
    const value = this._dictionary.get(key);

    if (!value) {
      console.error(`EntityStore: ${this._config.name || 'unknown'}: missing key "${key}" for get`);
      return null;
    }

    if (this._config.logActions) {
      console.log(`EntityStore: ${this._config.name || 'unknown'}: get "${key}"`);
    }

    return value;
  }

  getMany(keys: EntityKey[]) {
    return keys.map((key) => this.getOne(key));
  }

  addOne(value: T) {
    const key = this.getKey(value);

    if (this._dictionary.has(key)) {
      console.error(`EntityStore: ${this._config.name || 'unknown'}: duplicate key "${key}" for add`);
      return null;
    }

    this._dictionary.set(key, value);
    this._keys.add(key);

    const event: EntityStoreActionResult = { type: 'add', key };

    this._events$.next(event);

    if (this._config.logActions) {
      console.log(`EntityStore: ${this._config.name || 'unknown'}: add "${key}"`);
    }

    return event;
  }

  addMany(values: T[]) {
    const events = values.map((value) => this.addOne(value));

    return events;
  }

  updateOne(value: T) {
    const key = this.getKey(value);
    const existing = this._dictionary.get(key);

    if (!existing) {
      console.error(`EntityStore: ${this._config.name || 'unknown'}: missing key "${key}" for update`);
      return null;
    }

    this._dictionary.set(key, value);

    const event: EntityStoreActionResult = { type: 'update', key };

    this._events$.next(event);

    if (this._config.logActions) {
      console.log(`EntityStore: ${this._config.name || 'unknown'}: update "${key}"`);
    }

    return event;
  }

  updateMany(values: T[]) {
    const events = values.map((value) => this.updateOne(value));

    return events;
  }

  setOne(value: T) {
    const key = this.getKey(value);
    this._dictionary.set(key, value);
    this._keys.add(key);

    const event: EntityStoreActionResult = { type: 'set', key };

    this._events$.next(event);

    if (this._config.logActions) {
      console.log(`EntityStore: ${this._config.name || 'unknown'}: set "${key}"`);
    }

    return event;
  }

  setMany(values: T[]) {
    const events = values.map((value) => this.setOne(value));

    return events;
  }

  removeOne(key: EntityKey) {
    if (!this._dictionary.has(key)) {
      console.error(`EntityStore: ${this._config.name || 'unknown'}: missing key "${key}" for remove`);
      return null;
    }

    this._dictionary.delete(key);
    this._keys.delete(key);

    const event: EntityStoreActionResult = { type: 'remove', key };

    this._events$.next(event);

    if (this._config.logActions) {
      console.log(`EntityStore: ${this._config.name || 'unknown'}: remove "${key}"`);
    }

    return event;
  }

  removeMany(keys: EntityKey[]) {
    const events = keys.map((key) => this.removeOne(key));

    return events;
  }

  has(key: EntityKey) {
    return this._dictionary.has(key);
  }

  clear() {
    this._dictionary.clear();
    this._keys.clear();
  }

  getKey(value: T) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = (value as any)[this._config.idKey || 'id'] as string | number | undefined;

    if (key === undefined) {
      throw new Error(`EntityStore: ${this._config.name || 'unknown'}: missing key`);
    }

    return key;
  }

  logState() {
    console.log('EntityStore:', this._config.name, {
      dictionary: this._dictionary,
      keys: this._keys,
    });
  }
}
