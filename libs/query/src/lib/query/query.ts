import { BehaviorSubjectWithSubscriberCount } from '@ethlete/core';
import { finalize, interval, startWith, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { isBearerAuthProvider } from '../auth';
import { QueryClient } from '../query-client';
import { HttpStatusCode, Method as MethodType, request } from '../request';
import {
  BaseArguments,
  GqlQueryConfig,
  PollConfig,
  QueryAutoRefreshConfig,
  QueryState,
  QueryStateMeta,
  QueryStateType,
  RestQueryConfig,
  RouteType,
  RunQueryOptions,
} from './query.types';
import {
  computeQueryBody,
  computeQueryHeaders,
  computeQueryMethod,
  isGqlQueryConfig,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  takeUntilResponse,
} from './query.utils';

export class Query<
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments>,
  Method extends MethodType,
  Entity,
> {
  private _currentId = 0;
  private _pollingSubscription: Subscription | null = null;
  private _entitySubscription: Subscription | null = null;
  private _onAbort$ = new Subject<void>();
  private _currentPollConfig: PollConfig | null = null;

  /**
   * @internal
   */
  _isPollingPaused = false;

  private readonly _state$: BehaviorSubjectWithSubscriberCount<QueryState<Response>>;

  private get _nextId() {
    return ++this._currentId;
  }

  get state$() {
    return this._state$.asObservable();
  }

  get state() {
    return this._state$.value;
  }

  get isExpired() {
    if (!isQueryStateSuccess(this.state)) {
      return false;
    }

    const ts = this.state.meta.expiresAt;

    if (!ts) {
      return true;
    }

    return ts < Date.now();
  }

  get isInUse() {
    return this._state$.subscriberCount > 0;
  }

  get isPolling() {
    return !!this._pollingSubscription;
  }

  get autoRefreshOnConfig() {
    const base = this._queryConfig.autoRefreshOn ?? {};

    const transformed: Readonly<QueryAutoRefreshConfig> = {
      queryClientDefaultHeadersChange: base.queryClientDefaultHeadersChange ?? true,
      windowFocus: base.windowFocus ?? true,
    };

    return transformed;
  }

  /**
   * @internal
   */
  get _enableSmartPolling() {
    return this._queryConfig.enableSmartPolling ?? true;
  }

  get store() {
    return this._queryConfig.entity?.store ?? null;
  }

  constructor(
    private _client: QueryClient,
    private _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Entity>
      | GqlQueryConfig<Route, Response, Arguments, Entity>,
    private _routeWithParams: Route,
    private _args: Arguments,
  ) {
    this._state$ = new BehaviorSubjectWithSubscriberCount<QueryState<Response>>({
      type: QueryStateType.Prepared,
      meta: { id: this._currentId, triggeredVia: 'program' },
    });
  }

  execute(options?: RunQueryOptions) {
    const triggeredVia = options?._triggeredVia ?? 'program';

    if (!this.isExpired && !options?.skipCache && isQueryStateSuccess(this.state)) {
      return this;
    }

    if (this._queryConfig.secure && !this._client.authProvider) {
      throw new Error('Cannot execute secure query without auth provider');
    }

    const id = this._nextId;

    if (isQueryStateLoading(this._state$.value)) {
      this.abort();
    }

    const meta: QueryStateMeta = { id, triggeredVia };

    this._state$.next({
      type: QueryStateType.Loading,
      meta,
    });

    const method = computeQueryMethod({ config: this._queryConfig, client: this._client });
    const body = computeQueryBody({
      config: this._queryConfig,
      client: this._client,
      args: this._args,
      method,
    });
    const headers = computeQueryHeaders({ client: this._client, config: this._queryConfig, args: this._args });

    request<Response>({
      urlWithParams: this._routeWithParams,
      method,
      body,
      headers,
      reportProgress: this._queryConfig.reportProgress,
      responseType: this._queryConfig.responseType,
      withCredentials: this._queryConfig.withCredentials,
      cacheAdapter: this._client.config.request?.cacheAdapter,
      retryFn: this._client.config.request?.retryFn,
    })
      .pipe(takeUntil(this._onAbort$))
      .subscribe({
        next: (state) => {
          if (state.type === 'start' || state.type === 'delay-retry') {
            const newMeta: QueryStateMeta = {
              ...meta,
              isWaitingForRetry: state.type === 'delay-retry',
              retryDelay: state.retryDelay,
              retryNumber: state.retryNumber,
            };

            this._state$.next({
              type: QueryStateType.Loading,
              meta: newMeta,
            });
          } else if (state.type === 'download-progress') {
            this._state$.next({
              type: QueryStateType.Loading,
              progress: state.progress,
              partialText: state.partialText,
              meta,
            });
          } else if (state.type === 'upload-progress') {
            this._state$.next({
              type: QueryStateType.Loading,
              progress: state.progress,
              meta,
            });
          } else if (state.type === 'success') {
            const isResponseObject = typeof state.response === 'object';
            const isGql = isGqlQueryConfig(this._queryConfig);

            let responseData: Response | null = null;
            if (
              isGql &&
              isResponseObject &&
              !!state.response &&
              typeof state.response === 'object' &&
              'data' in state.response
            ) {
              responseData = state.response['data'] as Response;
            } else {
              responseData = state.response as Response;
            }

            this._state$.next({
              type: QueryStateType.Success,
              response: responseData,
              meta: { ...meta, expiresAt: state.expiresInTimestamp },
            });
          } else if (state.type === 'failure') {
            const failure = () => {
              this._state$.next({
                type: QueryStateType.Failure,
                error: state.error,
                meta,
              });
            };

            const bearerAuthProvider = this._getBearerAuthProvider();

            if (!bearerAuthProvider || options?._isUnauthorizedRetry) {
              return failure();
            } else if (
              state.error.status === HttpStatusCode.Unauthorized &&
              bearerAuthProvider.shouldRefreshOnUnauthorizedResponse
            ) {
              const query = bearerAuthProvider._refreshQuery();

              if (!query) {
                return failure();
              }

              query.state$
                .pipe(
                  takeUntilResponse(),
                  takeUntil(this._onAbort$),
                  tap((state) => {
                    if (isQueryStateSuccess(state)) {
                      this.execute({ ...options, _isUnauthorizedRetry: true });
                    } else if (isQueryStateFailure(state)) {
                      failure();
                    }
                  }),
                )
                .subscribe();
            } else {
              failure();
            }
          } else if (state.type === 'cancel') {
            this._state$.next({
              type: QueryStateType.Cancelled,
              meta,
            });
          }
        },
      });

    return this;
  }

  abort() {
    this._onAbort$.next();

    return this;
  }

  poll(config: PollConfig) {
    if (this._pollingSubscription) {
      return this;
    }

    this._currentPollConfig = config;

    const _interval = config.triggerImmediately
      ? interval(config.interval).pipe(startWith(-1))
      : interval(config.interval);

    this._pollingSubscription = _interval
      .pipe(
        takeUntil(config.takeUntil),
        finalize(() => this.stopPolling()),
      )
      .subscribe(() => {
        if (this.state.type === QueryStateType.Loading) {
          return;
        }

        this.execute({ skipCache: true, _triggeredVia: 'poll' });
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

  /**
   * @internal
   */
  _destroy() {
    this._state$.complete();
    this._onAbort$.complete();
    this._pollingSubscription?.unsubscribe();
    this._entitySubscription?.unsubscribe();
  }

  private _getBearerAuthProvider() {
    const authProvider = this._client.authProvider;

    if (authProvider && isBearerAuthProvider(authProvider)) {
      return authProvider;
    }

    return null;
  }
}
