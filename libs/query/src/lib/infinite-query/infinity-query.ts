/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, Subscription } from 'rxjs';
import { filterSuccess, QueryStateData, takeUntilResponse } from '../query';
import { AnyQueryCreator, QueryCreatorArgs, QueryCreatorReturnType } from '../query-client';
import { InfinityQueryConfig, InfinityQueryParamLocation } from './infinity-query.types';

export class InfinityQuery<
  QueryCreator extends AnyQueryCreator,
  Query extends QueryCreatorReturnType<QueryCreator>,
  Args extends QueryCreatorArgs<QueryCreator>,
  QueryResponse extends QueryStateData<Query['state']>,
  InfinityResponse extends unknown[],
> {
  private readonly _currentPage$ = new BehaviorSubject<number | null>(null);
  private readonly _currentCalculatedPage$ = new BehaviorSubject<number | null>(null);
  private readonly _totalPages$ = new BehaviorSubject<number | null>(null);
  private readonly _itemsPerPage$ = new BehaviorSubject<number>(this._config.limitParam?.value ?? 10);
  private readonly _currentQuery$ = new BehaviorSubject<Query | null>(null);
  private readonly _data$ = new BehaviorSubject<InfinityResponse>([] as any as InfinityResponse);

  private _subscriptions: Subscription[] = [];

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

  get currentQuery$() {
    return this._currentQuery$.asObservable();
  }

  get currentQuery() {
    return this._currentQuery$.getValue();
  }

  get data$() {
    return this._data$.asObservable();
  }

  get data() {
    return this._data$.getValue();
  }

  constructor(private _config: InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>) {}

  nextPage() {
    const newPage = (this._currentPage$.value ?? 0) + 1;
    const calculatedPage =
      this._config?.pageParam?.valueCalculator?.({
        page: newPage,
        totalPages: this.totalPages,
        itemsPerPage: this.itemsPerPage,
      }) ?? newPage;

    if (this.totalPages !== null && calculatedPage > this.totalPages) {
      console.error(
        'Cannot load more pages, already at the end. Make sure to not render the infinity query trigger using *ngIf canLoadMore',
      );
      return;
    }

    const args = this._prepareArgs(this._config, calculatedPage);

    const query = this._config.queryCreator.prepare(args).execute() as Query;
    this._handleNewQuery(query);

    this._currentPage$.next(newPage);
    this._currentCalculatedPage$.next(calculatedPage);
    this._currentQuery$.next(query);
  }

  reset(
    newConfig?: Omit<
      InfinityQueryConfig<QueryCreator, Args, QueryResponse, InfinityResponse>,
      'queryCreator' | 'response'
    >,
  ) {
    this._destroy();

    this._config = { ...this._config, ...(newConfig ?? {}) };

    this._currentPage$.next(null);
    this._currentCalculatedPage$.next(null);
    this._totalPages$.next(null);
    this._itemsPerPage$.next(this._config.limitParam?.value ?? 10);
    this._currentQuery$.next(null);

    this._data$.next([] as any as InfinityResponse);
  }

  _destroy() {
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._subscriptions = [];
  }

  private _handleNewQuery(query: Query) {
    const stateChangesSub = query.state$.pipe(takeUntilResponse(), filterSuccess()).subscribe({
      next: (state) => {
        let newData = this._config?.response.valueExtractor(state.response);

        if (this._config.response.reverse) {
          newData = [...newData].reverse() as InfinityResponse;
        }

        if (this._config.response.appendItemsTo === 'start') {
          newData = [...newData, ...this.data] as InfinityResponse;
        } else {
          newData = [...this.data, ...newData] as InfinityResponse;
        }

        this._data$.next(newData);

        const totalPages =
          this._config.response.totalPagesExtractor?.({
            response: state.response,
            itemsPerPage: this.itemsPerPage,
          }) ??
          state.response?.totalPages ??
          null;

        this._totalPages$.next(totalPages);
      },
      complete: () => {
        this._subscriptions = this._subscriptions.filter((sub) => sub !== stateChangesSub);
      },
    });

    this._subscriptions.push(stateChangesSub);
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
