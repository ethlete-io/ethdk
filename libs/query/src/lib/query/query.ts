import {
  BehaviorSubject,
  filter,
  interval,
  map,
  Observable,
  of,
  shareReplay,
  skip,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
} from 'rxjs';
import { isBearerAuthProvider } from '../auth';
import { EntityStore } from '../entity';
import { QueryClient } from '../query-client';
import { HttpStatusCode, request, RequestEvent } from '../request';
import {
  BaseArguments,
  ExecuteQueryOptions,
  GqlQueryConfig,
  PollConfig,
  QueryAutoRefreshConfig,
  QueryState,
  QueryStateMeta,
  QueryStateType,
  RestQueryConfig,
  RouteType,
} from './query.types';
import {
  computeQueryBody,
  computeQueryHeaders,
  computeQueryMethod,
  isGqlQueryConfig,
  isQueryStateLoading,
  isQueryStatePrepared,
  isQueryStateSuccess,
  takeUntilResponse,
} from './query.utils';

let _nextQueryId = 0;

export class Query<
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
  Id,
> {
  readonly _id = _nextQueryId++;

  private _currentLocalId = 0;
  private _pollingSubscription: Subscription | null = null;
  private _onAbort$ = new Subject<void>();
  private _currentPollConfig: PollConfig | null = null;

  /**
   * @internal
   */
  _isPollingPaused = false;

  private readonly _state$ = new BehaviorSubject<QueryState<Response>>({
    type: QueryStateType.Prepared,
    meta: { id: this._currentLocalId, triggeredVia: 'program' },
  });

  private get _nextId() {
    return ++this._currentLocalId;
  }

  get state$(): Observable<QueryState<Data>> {
    return this._state$.pipe(
      tap((s) => {
        if (!this._client.config.logging?.preparedQuerySubscriptions) return;

        if (isQueryStatePrepared(s)) {
          console.warn(
            `Query ${this._routeWithParams} was subscribed to in the prepared state. Did you forget to call .execute()?`,
          );
        }
      }),
      switchMap((s) => this._transformState(s)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * The current state of the query.
   *
   * **Warning!** This differs from the `state$` observable in that it does not use the query store. Thus, the response data might be outdated.
   * Use `state$` (or `firstValueFrom(state$)`) the most up-to-date data.
   */
  get rawState() {
    return this._state$.value;
  }

  get isExpired() {
    if (!isQueryStateSuccess(this._state$.value)) {
      return false;
    }

    const ts = this._state$.value.meta.expiresAt;

    if (!ts) {
      return true;
    }

    return ts < Date.now();
  }

  get isInUse() {
    return this._state$.observed;
  }

  /**
   * @internal
   */
  get _subscriberCount() {
    return this._state$.observers.length;
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

  /**
   * @internal
   */
  get _arguments() {
    return this._args;
  }

  get store() {
    return this._queryConfig.entity?.store ?? null;
  }

  constructor(
    private _client: QueryClient,
    private _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Store, Data, Id>
      | GqlQueryConfig<Route, Response, Arguments, Store, Data, Id>,

    /**
     * @internal
     */
    public _routeWithParams: Route,
    private _args: Arguments,
  ) {}

  execute(options: ExecuteQueryOptions = {}) {
    const { skipCache = false, _triggeredVia: triggeredVia = 'program', cancelPrevious = false } = options;
    const { authProvider } = this._client;
    const queryConfig = this._queryConfig;

    if (!this.isExpired && !skipCache && isQueryStateSuccess(this.rawState)) {
      return this;
    }

    if (queryConfig.secure && !authProvider) {
      throw new Error('Cannot execute secure query without auth provider');
    }

    const id = this._nextId;
    const meta: QueryStateMeta = { id, triggeredVia };

    if (isQueryStateLoading(this.rawState)) {
      if (cancelPrevious) {
        this.abort();
      } else {
        return this;
      }
    }

    this._state$.next({ type: QueryStateType.Loading, meta });

    const method = computeQueryMethod({ config: queryConfig, client: this._client });
    const body = computeQueryBody({ config: queryConfig, client: this._client, args: this._args, method });
    const headers = computeQueryHeaders({ client: this._client, config: queryConfig, args: this._args });

    request<Response>({
      urlWithParams: this._routeWithParams,
      method,
      body,
      headers,
      reportProgress: queryConfig.reportProgress,
      responseType: queryConfig.responseType,
      withCredentials: queryConfig.withCredentials,
      cacheAdapter: this._client.config.request?.cacheAdapter,
      retryFn: this._client.config.request?.retryFn,
    })
      .pipe(
        takeUntil(this._onAbort$),
        tap((state) => this._updateEntityState(state, meta, options)),
      )
      .subscribe();

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

    const interval$ = interval(config.interval);
    const poll$ = interval$.pipe(
      skip(config.triggerImmediately ? 0 : 1),
      takeUntil(config.takeUntil),
      takeWhile(() => !this._isPollingPaused),
      filter(() => !isQueryStateLoading(this._state$.value)),
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

  private _getBearerAuthProvider() {
    const authProvider = this._client.authProvider;

    if (authProvider && isBearerAuthProvider(authProvider)) {
      return authProvider;
    }

    return null;
  }

  private _updateEntityState(
    requestEvent: RequestEvent<Response>,
    meta: QueryStateMeta,
    options?: ExecuteQueryOptions,
  ) {
    switch (requestEvent.type) {
      case 'start':
      case 'delay-retry': {
        const { type, retryDelay, retryNumber } = requestEvent;
        const newMeta: QueryStateMeta = { ...meta, isWaitingForRetry: type === 'delay-retry', retryDelay, retryNumber };

        this._state$.next({
          type: QueryStateType.Loading,
          meta: newMeta,
        });
        break;
      }

      case 'upload-progress':
      case 'download-progress': {
        this._state$.next({
          type: QueryStateType.Loading,
          progress: requestEvent.progress,
          partialText: 'partialText' in requestEvent ? requestEvent.partialText : undefined,
          meta,
        });

        break;
      }

      case 'success': {
        const { response, expiresInTimestamp } = requestEvent;
        const isGql = isGqlQueryConfig(this._queryConfig);
        const responseData =
          isGql && typeof response === 'object' && !!response && 'data' in response
            ? (response['data'] as Response)
            : (response as Response);

        if (this._queryConfig.entity && this._queryConfig.entity.set) {
          const id = this._queryConfig.entity?.id({ args: this._args, response: responseData });

          this._queryConfig.entity?.set({
            args: this._args,
            response: responseData,
            id,
            store: this._queryConfig.entity.store,
          });
        }

        this._state$.next({
          type: QueryStateType.Success,
          response: responseData,
          meta: { ...meta, expiresAt: expiresInTimestamp },
        });

        break;
      }

      case 'failure': {
        const { error } = requestEvent;
        const failure = () => this._state$.next({ type: QueryStateType.Failure, error, meta });
        const bearerAuthProvider = this._getBearerAuthProvider();

        if (
          !bearerAuthProvider ||
          options?._isUnauthorizedRetry ||
          error.status !== HttpStatusCode.Unauthorized ||
          !bearerAuthProvider.shouldRefreshOnUnauthorizedResponse
        ) {
          return failure();
        }

        const query = bearerAuthProvider._refreshQuery();
        if (!query) return failure();

        query.state$
          .pipe(
            takeUntilResponse(),
            takeUntil(this._onAbort$),
            tap((state) =>
              isQueryStateSuccess(state) ? this.execute({ ...options, _isUnauthorizedRetry: true }) : failure(),
            ),
          )
          .subscribe();

        break;
      }

      case 'cancel': {
        this._state$.next({
          type: QueryStateType.Cancelled,
          meta,
        });

        break;
      }
    }
  }

  private _transformState(s: QueryState<Response>): Observable<QueryState<Data>> {
    if (!isQueryStateSuccess(s) || !this._queryConfig.entity?.get) {
      return of(s) as Observable<QueryState<Data>>;
    }

    const id = this._queryConfig.entity.id({ args: this._args, response: s.response });

    return this._queryConfig.entity
      .get({ args: this._args, id, response: s.response, store: this._queryConfig.entity.store })
      .pipe(map((v) => ({ ...s, response: v })));
  }
}
