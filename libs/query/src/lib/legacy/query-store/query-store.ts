import { Subject, fromEvent, take, takeUntil, timer } from 'rxjs';
import { AnyV2Query } from '../query';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export class QueryStore {
  /**
   * @internal
   */
  readonly _store = new Map<string, AnyV2Query>();

  private garbageCollector: number | null = null;
  private isInLowResourceMode = false;
  private lastBlurTimestamp = Date.now();

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
    this.initSmartQueryHandling();
  }

  add(id: string, query: AnyV2Query) {
    this._store.set(id, query);

    this.initGarbageCollector();

    this.logState(id, query, 'SET');

    this._storeChange$.next(id);
  }

  get<T extends AnyV2Query>(id: string): T | null {
    return (this._store.get(id) as T) ?? null;
  }

  remove(id: string) {
    this._store.delete(id);

    this.logState(id, null, 'REMOVE');

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

  private initSmartQueryHandling() {
    if (typeof window === 'undefined') return;

    const windowBlur$ = fromEvent<Event>(window, 'blur');
    const windowFocus$ = fromEvent<Event>(window, 'focus');

    windowBlur$.subscribe(() => {
      timer(5000)
        .pipe(takeUntil(windowFocus$), take(1))
        .subscribe(() => {
          this.lastBlurTimestamp = Date.now();
          this.isInLowResourceMode = true;
          this.stopGarbageCollector();

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
      if (!this.isInLowResourceMode) {
        return;
      }

      this.isInLowResourceMode = false;

      if (this._config?.enableSmartPolling || this._config?.autoRefreshQueriesOnWindowFocus) {
        this.forEach((query) => {
          if (this._config?.enableSmartPolling && query._isPollingPaused) {
            query.resumePolling();
          }

          if (Date.now() - this.lastBlurTimestamp > 15000) {
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

      this.initGarbageCollector();
    });
  }

  private logState(key: string | null, item: AnyV2Query | null, operation: string) {
    if (!this._config?.enableChangeLogging) return;

    const stateAsJson: Record<string, AnyV2Query> = {};

    this._store.forEach((value, key) => {
      stateAsJson[key] = value;
    });

    console.log(`%c[${operation}] ${key}`, 'font-weight: bold');

    console.log({ operation, key, item });
    console.log(stateAsJson);
  }

  private initGarbageCollector() {
    if (typeof window === 'undefined') return;

    if (this.garbageCollector !== null) {
      return;
    }

    this.logGarbageCollector('Start');

    this.garbageCollector = window.setInterval(() => {
      this.runGarbageCollector();
    }, 15000);
  }

  private stopGarbageCollector() {
    if (typeof window === 'undefined') return;

    if (this.garbageCollector !== null) {
      window.clearInterval(this.garbageCollector);
      this.garbageCollector = null;
      this.logGarbageCollector('Stop');
    }
  }

  private runGarbageCollector() {
    this.logGarbageCollector('Collecting...');

    this._store.forEach((item, key) => {
      if (item.isExpired && !item.isInUse) {
        this.remove(key);
      }
    });

    this.logGarbageCollector('Collection done');

    if (!this._store.size) {
      this.stopGarbageCollector();
    }
  }

  private logGarbageCollector(action: string) {
    if (!this._config?.enableGarbageCollectorLogging) return;

    console.log(`%cGC: ${action}`, 'color: yellow; font-weight: bold');
  }
}
