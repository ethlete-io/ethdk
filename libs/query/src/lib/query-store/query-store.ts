import { AnyQuery } from '../query';

export class QueryStore {
  private readonly _store = new Map<string, AnyQuery>();
  private _garbageCollector: number | null = null;

  constructor(
    private _config?: {
      enableChangeLogging?: boolean;
      enableGarbageCollectorLogging?: boolean;
    },
  ) {}

  add(id: string, query: AnyQuery) {
    this._store.set(id, query);

    this._initGarbageCollector();

    this._logState(id, query, 'SET');
  }

  get(id: string) {
    return this._store.get(id) ?? null;
  }

  remove(id: string) {
    this._store.delete(id);

    this._logState(id, null, 'REMOVE');
  }

  private _logState(key: string | null, item: AnyQuery | null, operation: string) {
    if (!this._config?.enableChangeLogging) return;

    const stateAsJson: Record<string, AnyQuery> = {};

    this._store.forEach((value, key) => {
      stateAsJson[key] = value;
    });

    console.log(`%c[${operation}] ${key}`, 'font-weight: bold');

    console.log({ operation, key, item });
    console.log(stateAsJson);
  }

  private _initGarbageCollector() {
    if (this._garbageCollector !== null) {
      return;
    }

    this._logGarbageCollector('Start');

    this._garbageCollector = window.setInterval(() => {
      this._runGarbageCollector();
    }, 15000);
  }

  private _stopGarbageCollector() {
    if (this._garbageCollector !== null) {
      window.clearInterval(this._garbageCollector);
      this._garbageCollector = null;
    }
  }

  private _runGarbageCollector() {
    this._logGarbageCollector('Collecting...');

    this._store.forEach((item, key) => {
      if (item.isExpired) {
        this.remove(key);
      }
    });

    this._logGarbageCollector('Collection done');

    if (!this._store.size) {
      this._stopGarbageCollector();
      this._logGarbageCollector('Stop');
    }
  }

  private _logGarbageCollector(action: string) {
    if (!this._config?.enableGarbageCollectorLogging) return;

    console.log(`%cGC: ${action}`, 'color: yellow; font-weight: bold');
  }
}
