import { BehaviorSubject, Observable, combineLatest, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { AnyLegacyQueryCreator } from '../interop';
import { filterSuccess } from '../query';
import { AnyQueryCreator, ConstructQuery, QueryArgsOf, QueryDataOf } from '../query-creator';
import { InfinityQueryConfig, InfinityQueryParamLocation } from './infinity-query.types';

export class InfinityQuery<
  QueryCreator extends AnyQueryCreator | AnyLegacyQueryCreator,
  Query extends ConstructQuery<QueryCreator>,
  Args extends QueryArgsOf<QueryCreator>,
  QueryResponse extends QueryDataOf<QueryCreator>,
  InfinityResponse extends unknown[],
> {
  private readonly _queries$ = new BehaviorSubject<Query[]>([]);
  private readonly _currentPage$ = new BehaviorSubject<number | null>(null);
  private readonly _currentCalculatedPage$ = new BehaviorSubject<number | null>(null);
  private readonly _totalPages$ = new BehaviorSubject<number | null>(null);
  private readonly _itemsPerPage$ = new BehaviorSubject<number>(10);

  private readonly _data$ = this._queries$.pipe(
    switchMap((queries) => {
      if (!queries.length) {
        return of([]);
      }

      return combineLatest(
        queries.map((query) =>
          query.state$.pipe(
            filterSuccess(),
            map((state) => ({ state, query })),
          ),
        ),
      );
    }),
    tap((stateMaps) => {
      const lastState = stateMaps[stateMaps.length - 1]?.state;
      const lastQuery = stateMaps[stateMaps.length - 1]?.query;

      if (!lastState || !lastQuery) {
        return;
      }

      const totalPages =
        this._config.response.totalPagesExtractor?.({
          response: lastState.response as QueryResponse,
          itemsPerPage: this.itemsPerPage,
          args: lastQuery._arguments,
        }) ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lastState.response as any)?.totalPages ??
        null;

      this._totalPages$.next(totalPages);
    }),
    map((stateMaps) => {
      if (!stateMaps.length) {
        return null;
      }

      const fullData = stateMaps.reduce(
        (acc, stateMap) => {
          const valExtractFn = this._config?.response?.valueExtractor;
          let data = valExtractFn
            ? valExtractFn?.(stateMap.state.response as QueryResponse)
            : (stateMap.state.response as InfinityResponse);

          if (this._config.response.reverse) {
            data = [...data].reverse() as InfinityResponse;
          }

          if (this._config.response.appendItemsTo === 'start') {
            acc.unshift(...data);
          } else {
            acc.push(...data);
          }
          return acc;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [] as any as InfinityResponse,
      );

      return fullData;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private readonly _lastQuery$ = this._queries$.pipe(
    map((queries) => queries[queries.length - 1] ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  get currentPage$() {
    return this._currentPage$.asObservable();
  }

  get currentPage() {
    return this._currentPage$.getValue();
  }

  get currentCalculatedPage$() {
    return this._currentCalculatedPage$.asObservable();
  }

  get currentCalculatedPage() {
    return this._currentCalculatedPage$.getValue();
  }

  get totalPages$() {
    return this._totalPages$.asObservable();
  }

  get totalPages() {
    return this._totalPages$.getValue();
  }

  get itemsPerPage$() {
    return this._itemsPerPage$.asObservable();
  }

  get itemsPerPage() {
    return this._itemsPerPage$.getValue();
  }

  get data$() {
    return this._data$;
  }

  get currentQuery$() {
    return this._lastQuery$;
  }

  constructor(
    private _config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
    private _destroy$: Observable<boolean>,
  ) {
    this._itemsPerPage$.next(this._config.limitParam?.value ?? 10);
  }

  nextPage() {
    const newPage = (this._currentPage$.value ?? 0) + 1;
    const calculatedPage =
      this._config?.pageParam?.valueCalculator?.({
        page: newPage,
        totalPages: this.totalPages,
        itemsPerPage: this.itemsPerPage,
      }) ?? newPage;

    if (this.totalPages !== null && newPage > this.totalPages) {
      console.error(
        'Cannot load more pages, already at the end. Make sure to not render the infinity query trigger using *ngIf canLoadMore',
      );
      return;
    }

    const args = this._prepareArgs(this._config, calculatedPage);

    const query = this._config.queryCreator.prepare(args).execute() as Query;

    if (this._config.pollingInterval) {
      query.poll({ interval: this._config.pollingInterval, takeUntil: this._destroy$ });
    }

    this._queries$.next([...this._queries$.value, query]);

    this._currentPage$.next(newPage);
    this._currentCalculatedPage$.next(calculatedPage);
  }

  reset(
    newConfig?: Omit<
      InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
      'queryCreator' | 'response'
    >,
  ) {
    this._config = { ...this._config, ...(newConfig ?? {}) };

    this._currentPage$.next(null);
    this._currentCalculatedPage$.next(null);
    this._totalPages$.next(null);
    this._itemsPerPage$.next(this._config.limitParam?.value ?? 10);
    this._queries$.next([]);

    this.nextPage();
  }

  private _prepareArgs(config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>, page: number) {
    const pageParamLocation = this._getPageParamLocation(config?.pageParam?.location);

    const pageArgs = {
      [pageParamLocation]: {
        [config?.pageParam?.key ?? 'page']: page,
      },
    };

    const limitParamLocation = this._getPageParamLocation(config?.limitParam?.location);

    const limitArgs = {
      [limitParamLocation]: {
        [config?.limitParam?.key ?? 'limit']: config?.limitParam?.value ?? 10,
      },
    };

    const defaultConfig = config?.defaultArgs ?? {};

    const mergedArgs =
      pageParamLocation === limitParamLocation
        ? {
            ...defaultConfig,
            [pageParamLocation]: {
              ...(config?.defaultArgs?.[pageParamLocation] ?? {}),
              ...pageArgs[limitParamLocation],
              ...limitArgs[limitParamLocation],
            },
          }
        : {
            ...defaultConfig,
            [pageParamLocation]: {
              ...(config?.defaultArgs?.[pageParamLocation] ?? {}),
              ...pageArgs[pageParamLocation],
            },
            [limitParamLocation]: {
              ...(config?.defaultArgs?.[limitParamLocation] ?? {}),
              ...limitArgs[limitParamLocation],
            },
          };

    return mergedArgs;
  }

  private _getPageParamLocation(location: InfinityQueryParamLocation | undefined) {
    const loc = location ?? 'query';

    switch (loc) {
      case 'path':
        return 'pathParams';
      case 'query':
        return 'queryParams';
      case 'body':
        return 'body';
      case 'header':
        return 'headers';
      case 'variable':
        return 'variables';
      default:
        throw new Error(`Invalid pageParamLocation: ${loc}`);
    }
  }
}
