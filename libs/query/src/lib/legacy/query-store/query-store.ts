import { Subject, fromEvent, take, takeUntil, timer } from 'rxjs';
import { AnyV2Query } from '../query';

export class QueryStore {
  /**
   * @internal
   */
  readonly _store = new Map<string, AnyV2Query>();

  private _garbageCollector: number | null = null;
  private _isInLowResourceMode = false;
  private _lastBlurTimestamp = Date.now();

  private _storeChange$ = new Subject<string>();
  private _queryCreated$ = new Subject<AnyV2Query>();

  readonly storeChange$ = this._storeChange$.asObservable();
  readonly queryCreated$ = this._queryCreated$.asObservable();

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

  add(id: string, query: AnyV2Query) {
    this._store.set(id, query);

    this._initGarbageCollector();

    this._logState(id, query, 'SET');

    this._storeChange$.next(id);
  }

  get<T extends AnyV2Query>(id: string): T | null {
    return (this._store.get(id) as T) ?? null;
  }

  remove(id: string) {
    this._store.delete(id);

    this._logState(id, null, 'REMOVE');

    this._storeChange$.next(id);
  }

  forEach(callback: (value: AnyV2Query, key: string) => void) {
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

  /**
   * @internal
   */
  _dispatchQueryCreated(query: AnyV2Query) {
    this._queryCreated$.next(query);
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

  private _logState(key: string | null, item: AnyV2Query | null, operation: string) {
    if (!this._config?.enableChangeLogging) return;

    const stateAsJson: Record<string, AnyV2Query> = {};

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
