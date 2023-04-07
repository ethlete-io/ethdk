import { BehaviorSubjectWithSubscriberCount } from '@ethlete/core';
import {
  finalize,
  interval,
  map,
  Observable,
  of,
  startWith,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { isBearerAuthProvider } from '../auth';
import { EntityStore } from '../entity';
import { QueryClient } from '../query-client';
import { HttpStatusCode, request, RequestEvent } from '../request';
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
  isQueryStateLoading,
  isQueryStateSuccess,
  takeUntilResponse,
} from './query.utils';

export class Query<
  Response,
  Arguments extends BaseArguments | undefined,
  Route extends RouteType<Arguments>,
  Store extends EntityStore<unknown>,
  Data,
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

  get state$(): Observable<QueryState<Data>> {
    return this._state$.pipe(
      switchMap((s) => {
        if (!isQueryStateSuccess(s) || !this._queryConfig.entity?.get) {
          return of(s) as Observable<QueryState<Data>>;
        }

        const id = this._queryConfig.entity.id({ args: this._args, response: s.response });

        return this._queryConfig.entity
          .get({
            args: this._args,
            id,
            response: s.response,
            store: this._queryConfig.entity.store,
          })
          .pipe(map((v) => ({ ...s, response: v })));
      }),
    );
  }

  /**
   * The current state of the query.
   *
   * **Does not** include the response. Use `state$` (or `firstValueFrom(state$)`) to get it.
   */
  get state() {
    return this._state$.value as QueryState<never>;
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
      | RestQueryConfig<Route, Response, Arguments, Store, Data>
      | GqlQueryConfig<Route, Response, Arguments, Store, Data>,
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

    if (!this.isExpired && !options?.skipCache && isQueryStateSuccess(this._state$.value)) {
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
        next: (state) => this._updateEntityState(state, meta, options),
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
        if (isQueryStateLoading(this._state$.value)) {
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

  private _updateEntityState(requestEvent: RequestEvent<Response>, meta: QueryStateMeta, options?: RunQueryOptions) {
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
}
