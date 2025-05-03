import { toObservable } from '@angular/core/rxjs-interop';
import { filter, interval, map, Observable, ReplaySubject, skip, Subscription, takeUntil, takeWhile } from 'rxjs';
import { EntityStore } from '../../entity';
import {
  BaseArguments,
  ExecuteQueryOptions,
  Failure,
  filterFailure,
  filterSuccess,
  isQueryStateCancelled,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStatePrepared,
  Loading,
  PollConfig,
  Prepared,
  QueryAutoRefreshConfig,
  QueryState,
  QueryStateMeta,
  QueryStateType,
  RouteType,
  Success,
  takeUntilResponse,
} from '../../query';
import { RequestError } from '../../request';
import { AnyQuery, Query, QueryArgs, QueryArgsOf, QueryExecutionState, RequestArgs, ResponseType } from '../http';

export type CreateLegacyQueryOptions<TArgs extends QueryArgs> = {
  query: Query<TArgs>;
};

const transformExecStateToQueryState = <TArgs extends QueryArgs>(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQuery = LegacyQuery<any, any, any, any, any, any, any>;

export class LegacyQuery<
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
  TNewQuery extends AnyQuery,
> {
  constructor(
    private newQuery: TNewQuery,
    private args: RequestArgs<QueryArgsOf<TNewQuery>>,
  ) {
    this.state$ = toObservable(this.newQuery.executionState).pipe(
      map((execState) => transformExecStateToQueryState(execState)),
    ) as Observable<QueryState<Data>>;
  }

  private _pollingSubscription: Subscription | null = null;
  private _currentPollConfig: PollConfig | null = null;

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
    if (isQueryStateLoading(this.rawState)) {
      return false;
    }

    if (
      isQueryStatePrepared(this.rawState) ||
      isQueryStateCancelled(this.rawState) ||
      isQueryStateFailure(this.rawState)
    ) {
      return true;
    }

    console.warn('Query interop: isExpired is not supported for success state. Falling back to false.');

    return false;
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

  destroy() {
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;
    this._dependentsChanged$.complete();
    this.newQuery.subtle.destroy();
  }

  execute(options: ExecuteQueryOptions = {}) {
    this.newQuery.execute({ args: this.args, options: { allowCache: options.skipCache !== true } });

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
}
