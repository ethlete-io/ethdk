import { fromEvent, take, takeUntil, timer } from 'rxjs';
import { AnyQuery } from '../query';

export class QueryStore {
  private readonly _store = new Map<string, AnyQuery>();
  private _garbageCollector: number | null = null;
  private _isInLowResourceMode = false;
  private _lastBlurTimestamp = Date.now();

  constructor(
    private _config?: {
      enableChangeLogging?: boolean;
      enableGarbageCollectorLogging?: boolean;
      autoRefreshQueriesOnWindowFocus?: boolean;
      enableSmartPolling?: boolean;
    },
  ) {
    this._initSmartQueryHandling();
  }

  add(id: string, query: AnyQuery) {
    this._store.set(id, query);

    this._initGarbageCollector();

    this._logState(id, query, 'SET');
  }

  get<T extends AnyQuery>(id: string): T | null {
    return (this._store.get(id) as T) ?? null;
  }

  remove(id: string) {
    this._store.delete(id);

    this._logState(id, null, 'REMOVE');
  }

  forEach(callback: (value: AnyQuery, key: string) => void) {
    for (const [key, query] of this._store) {
      callback(query, key);
    }
  }

  refreshQueriesInUse(config?: { ignoreCacheValidity?: boolean; purgeUnused?: boolean }) {
    const { ignoreCacheValidity, purgeUnused } = config ?? {};

    for (const [key, query] of this._store) {
      if (
        query.isInUse &&
        (query.isExpired || ignoreCacheValidity) &&
        query.autoRefreshOnConfig.queryClientDefaultHeadersChange
      ) {
        query.execute({ skipCache: true, _triggeredVia: 'auto' });
      } else if (purgeUnused && !query.isInUse) {
        this.remove(key);
      }
    }
  }

  private _initSmartQueryHandling() {
    const windowBlur$ = fromEvent<Event>(window, 'blur');
    const windowFocus$ = fromEvent<Event>(window, 'focus');

    windowBlur$.subscribe(() => {
      timer(5000)
        .pipe(takeUntil(windowFocus$), take(1))
        .subscribe(() => {
          this._lastBlurTimestamp = Date.now();
          this._isInLowResourceMode = true;
          this._stopGarbageCollector();

          if (this._config?.enableSmartPolling) {
            this.forEach((query) => {
              if (!query.isPolling || !query._enableSmartPolling) {
                return;
              }

              query.pausePolling();
            });
          }
        });
    });

    windowFocus$.subscribe(() => {
      if (!this._isInLowResourceMode) {
        return;
      }

      this._isInLowResourceMode = false;

      if (this._config?.enableSmartPolling || this._config?.autoRefreshQueriesOnWindowFocus) {
        this.forEach((query) => {
          if (this._config?.enableSmartPolling && query._isPollingPaused) {
            query.resumePolling();
          }

          if (Date.now() - this._lastBlurTimestamp > 15000) {
            if (
              this._config?.autoRefreshQueriesOnWindowFocus &&
              query.isExpired &&
              query.isInUse &&
              query.autoRefreshOnConfig.windowFocus
            ) {
              query.execute({ skipCache: true, _triggeredVia: 'auto' });
            }
          }
        });
      }

      this._initGarbageCollector();
    });
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
      this._logGarbageCollector('Stop');
    }
  }

  private _runGarbageCollector() {
    this._logGarbageCollector('Collecting...');

    this._store.forEach((item, key) => {
      if (item.isExpired && !item.isInUse) {
        this.remove(key);
      }
    });

    this._logGarbageCollector('Collection done');

    if (!this._store.size) {
      this._stopGarbageCollector();
    }
  }

  private _logGarbageCollector(action: string) {
    if (!this._config?.enableGarbageCollectorLogging) return;

    console.log(`%cGC: ${action}`, 'color: yellow; font-weight: bold');
  }
}
