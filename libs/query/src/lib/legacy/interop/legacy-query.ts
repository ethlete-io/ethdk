import { effect, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  filter,
  interval,
  map,
  Observable,
  of,
  ReplaySubject,
  shareReplay,
  skip,
  Subscription,
  switchMap,
  takeUntil,
  takeWhile,
} from 'rxjs';
import { AnyNewQuery, Query, QueryArgs, QueryArgsOf, QueryExecutionState, RequestArgs, ResponseType } from '../../http';
import { EntityStore } from '../entity';
import {
  BaseArguments,
  ExecuteQueryOptions,
  Failure,
  filterFailure,
  filterSuccess,
  isQueryStateLoading,
  isQueryStateSuccess,
  Loading,
  PollConfig,
  Prepared,
  QueryAutoRefreshConfig,
  QueryEntityConfig,
  QueryState,
  QueryStateMeta,
  QueryStateType,
  RouteType,
  Success,
  takeUntilResponse,
} from '../query';
import { RequestError } from '../request';

export type CreateLegacyQueryOptions<TArgs extends QueryArgs> = {
  query: Query<TArgs>;
};

export const transformExecStateToQueryState = <TArgs extends QueryArgs>(
  execState: QueryExecutionState<TArgs> | null,
): QueryState<ResponseType<TArgs>> => {
  const meta: QueryStateMeta = { id: -1, triggeredVia: 'program' };

  switch (execState?.type) {
    case 'loading': {
      const loading: Loading = {
        meta,
        type: QueryStateType.Loading,
        ...(execState.loading.progress
          ? {
              progress: {
                current: execState.loading.progress.loaded,
                percentage: execState.loading.progress.percentage,
                total: execState.loading.progress.total,
              },
            }
          : {}),
      };

      return loading;
    }
    case 'success': {
      const success: Success<ResponseType<TArgs>> = {
        headers: {},
        meta,
        response: execState.response,
        type: QueryStateType.Success,
      };

      return success;
    }
    case 'failure': {
      const error: Failure = {
        error: {
          detail: execState.error.raw.error,
          httpErrorResponse: execState.error.raw,
          status: execState.error.raw.status,
          statusText: execState.error.raw.statusText,
          url: execState.error.raw.url || '',
        },
        meta,
        type: QueryStateType.Failure,
      };

      return error;
    }
    default: {
      const prepared: Prepared = {
        meta,
        type: QueryStateType.Prepared,
      };

      return prepared;
    }
  }
};

export const isLegacyQuery = <T extends AnyLegacyQuery>(query: unknown): query is T => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return false;
  }

  if (!('newQuery' in query)) {
    return false;
  }

  return true;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQuery = LegacyQuery<any, any, any, any, any, any, any>;

export class LegacyQuery<
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
  TNewQuery extends AnyNewQuery,
> {
  /**
   * @internal
   */
  _pollingSubscription: Subscription | null = null;
  /**
   * @internal
   */
  _currentPollConfig: PollConfig | null = null;

  /**
   * @internal
   */
  storeSyncEffect = effect(() => {
    const res = this.newQuery.response();

    untracked(() => {
      if (this.entity?.set) {
        const id = this.entity.id({ args: this._arguments, response: res });

        this.entity.set({
          args: this._arguments,
          response: res,
          id,
          store: this.entity.store,
        });
      }
    });
  });

  /**
   * @internal
   */
  _dependents: Record<number, number> = {};

  /**
   * @internal
   */
  _dependentsChanged$ = new ReplaySubject<Record<number, number>>();

  /**
   * @internal
   */
  _isPollingPaused = false;

  state$: Observable<QueryState<Data>>;

  get rawState() {
    return transformExecStateToQueryState(this.newQuery.executionState());
  }

  get isExpired() {
    return this.newQuery.subtle.request()?.isStale();
  }

  get isInUse() {
    return true;
  }

  /**
   * @internal
   */
  get _subscriberCount() {
    return 0;
  }

  get isPolling() {
    return !!this._pollingSubscription;
  }

  get autoRefreshOnConfig() {
    const transformed: Readonly<QueryAutoRefreshConfig> = {
      queryClientDefaultHeadersChange: false,
      windowFocus: false,
    };

    return transformed;
  }

  /**
   * @internal
   */
  get _enableSmartPolling() {
    return false;
  }

  get store() {
    return null;
  }

  get canBeCached() {
    return false;
  }

  get _isInMockMode() {
    return false;
  }

  constructor(
    public newQuery: TNewQuery,
    public _arguments: RequestArgs<QueryArgsOf<TNewQuery>>,
    public entity?: QueryEntityConfig<Store, Data, Response, Arguments, Id>,
  ) {
    this.state$ = toObservable(this.newQuery.executionState, { injector: this.newQuery.subtle.injector }).pipe(
      map((execState) => transformExecStateToQueryState(execState)),
      switchMap((s) => this._transformState(s)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.newQuery.subtle.destroyRef.onDestroy(() => this.destroy());
  }

  destroy() {
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;
    this._dependentsChanged$.complete();
    this.newQuery.subtle.destroy();
    this.storeSyncEffect.destroy();
  }

  execute(options: ExecuteQueryOptions = {}) {
    untracked(() =>
      this.newQuery.execute({ args: this._arguments, options: { allowCache: options.skipCache !== true } }),
    );

    return this;
  }

  abort() {
    if (!isQueryStateLoading(this.rawState)) {
      return this;
    }

    this.newQuery.reset();

    return this;
  }

  poll(config: PollConfig) {
    if (this._pollingSubscription) {
      return this;
    }

    this._currentPollConfig = config;

    const interval$ = interval(config.interval);
    const poll$ = interval$.pipe(
      skip(config.triggerImmediately ? 0 : 1),
      takeUntil(config.takeUntil),
      takeWhile(() => !this._isPollingPaused),
      filter(() => !isQueryStateLoading(this.rawState)),
    );

    this._pollingSubscription = poll$.subscribe({
      next: () => this.execute({ skipCache: true, _triggeredVia: 'poll' }),
      complete: () => this.stopPolling(),
    });

    return this;
  }

  stopPolling() {
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;
    this._currentPollConfig = null;

    return this;
  }

  pausePolling() {
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;

    this._isPollingPaused = true;

    return this;
  }

  resumePolling() {
    if (!this._isPollingPaused || !this._currentPollConfig) {
      return this;
    }

    this._isPollingPaused = false;

    return this.poll({ ...this._currentPollConfig, triggerImmediately: true });
  }

  onSuccess(callback: (response: Data) => void) {
    this.state$.pipe(takeUntilResponse(), filterSuccess()).subscribe((state) => callback(state.response));
    return this;
  }

  onFailure(callback: (error: RequestError<unknown>) => void) {
    this.state$.pipe(takeUntilResponse(), filterFailure()).subscribe((state) => callback(state.error));
    return this;
  }

  /**
   * @internal
   */
  _addDependent(tNodeIndex: number) {
    if (!this._dependents[tNodeIndex]) {
      this._dependents[tNodeIndex] = 0;
    }

    this._dependents[tNodeIndex]++;

    this._dependentsChanged$.next(this._dependents);
  }

  /**
   * @internal
   */
  _removeDependent(tNodeIndex: number) {
    const count = this._dependents[tNodeIndex];
    if (count === undefined) {
      return;
    }

    if (this._dependents[tNodeIndex] !== undefined) {
      this._dependents[tNodeIndex]--;
    }

    if (count <= 1) {
      delete this._dependents[tNodeIndex];
    }

    this._dependentsChanged$.next(this._dependents);
  }

  /**
   * @internal
   */
  _hasDependents() {
    return Object.keys(this._dependents).length > 0;
  }

  /**
   * @internal
   */
  _transformState(s: QueryState<Response>): Observable<QueryState<Data>> {
    if (!isQueryStateSuccess(s) || !this.entity?.get) {
      return of(s) as Observable<QueryState<Data>>;
    }

    const id = this.entity.id({ args: this._arguments, response: s.response });

    return this.entity
      .get({ args: this._arguments, id, response: s.response, store: this.entity.store })
      .pipe(map((v) => ({ ...s, response: v })));
  }
}
