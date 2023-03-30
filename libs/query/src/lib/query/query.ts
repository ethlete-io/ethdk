import { BehaviorSubjectWithSubscriberCount } from '@ethlete/core';
import { finalize, interval, startWith, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { QueryClient, ResponseTransformerType } from '../query-client';
import { Method as MethodType, request } from '../request';
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
  WithUseResultIn,
} from './query.types';
import {
  computeQueryBody,
  computeQueryHeaders,
  computeQueryMethod,
  filterSuccess,
  isGqlQueryConfig,
  isQueryStateLoading,
  isQueryStateSuccess,
  takeUntilResponse,
} from './query.utils';

export class Query<
  Response,
  Arguments extends (BaseArguments & WithUseResultIn<Response, ResponseTransformer>) | undefined,
  Route extends RouteType<Arguments>,
  Method extends MethodType,
  ResponseTransformer extends ResponseTransformerType<Response>,
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

  private readonly _state$: BehaviorSubjectWithSubscriberCount<QueryState<ReturnType<ResponseTransformer>, Response>>;

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
      | RestQueryConfig<Route, Response, Arguments, ResponseTransformer, Entity>
      | GqlQueryConfig<Route, Response, Arguments, ResponseTransformer, Entity>,
    private _routeWithParams: Route,
    private _args: Arguments,
  ) {
    this._state$ = new BehaviorSubjectWithSubscriberCount<QueryState<ReturnType<ResponseTransformer>, Response>>({
      type: QueryStateType.Prepared,
      meta: { id: this._currentId, triggeredVia: 'program' },
    });

    if (this._queryConfig.entity?.store) {
      this._entitySubscription = this._queryConfig.entity.store.events$.subscribe((event) => {
        if (event.type !== 'update' && event.type !== 'set') {
          return;
        }

        if (!isQueryStateSuccess(this.state)) {
          return;
        }

        const response = this.state.response as any;
        const rawResponse = this.state.rawResponse;

        const key = this._queryConfig.entity?.store.config.idKey;

        if (!key) {
          return;
        }

        const newData = this._queryConfig.entity?.store.getOne(event.key);

        if (!newData) {
          return;
        }

        const newResponse = this._queryConfig.entity?.valueUpdater
          ? this._queryConfig.entity?.valueUpdater({
              args: this._args,
              entity: newData,
              rawResponse,
              response,
            })
          : response[key] === (newData as any)[key]
          ? {
              response: newData,
              rawResponse: newData,
            }
          : null;

        if (!newResponse) {
          return;
        }

        this._state$.next({
          ...this.state,
          response: newResponse.response as any,
          rawResponse: newResponse.rawResponse as any,
          meta: {
            ...this.state.meta,
            triggeredVia: 'auto',
          },
        });
      });
    }
  }

  clone() {
    return this._client.fetch<Route, Response, Arguments, Method, ResponseTransformer, Entity>(this._queryConfig);
  }

  execute<
    ComputedResponse extends ReturnType<ResponseTransformer>,
    EntityResponse extends ResponseTransformer extends (response: Response) => infer R ? R : Response,
  >(options?: RunQueryOptions) {
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

    this._updateUseResultInDependencies();

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

            const transformedResponse = this._queryConfig.responseTransformer
              ? this._queryConfig.responseTransformer(responseData)
              : responseData;

            this._queryConfig.entity?.successAction?.({
              args: this._args,
              rawResponse: state.response,
              response: transformedResponse as EntityResponse,
              store: this._queryConfig.entity.store,
            });

            this._state$.next({
              type: QueryStateType.Success,
              rawResponse: state.response,
              response: transformedResponse as ComputedResponse,
              meta: { ...meta, expiresAt: state.expiresInTimestamp },
            });
          } else if (state.type === 'failure') {
            this._state$.next({
              type: QueryStateType.Failure,
              error: state.error,
              meta,
            });
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

  private _updateUseResultInDependencies() {
    if (!this._args?.useResultIn?.length) {
      return;
    }

    this.state$
      .pipe(
        filterSuccess(),
        takeUntil(this._onAbort$),
        takeUntilResponse(),
        tap((state) => {
          if (!this._args?.useResultIn) {
            return;
          }

          for (const query of this._args.useResultIn) {
            query._state$.next({
              type: QueryStateType.Success,
              meta: { ...state.meta, id: query._nextId },
              rawResponse: state.rawResponse,
              response: state.response,
            });
          }
        }),
      )
      .subscribe();
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
}
