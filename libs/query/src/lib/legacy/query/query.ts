import { untracked } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  interval,
  map,
  Observable,
  of,
  ReplaySubject,
  shareReplay,
  skip,
  Subject,
  Subscription,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import { isBearerAuthProvider } from '../auth';
import { EntityStore } from '../entity';
import { QueryClient, shouldCacheQuery } from '../query-client';
import { request, RequestError, RequestEvent, RequestHeaders } from '../request';
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
  filterFailure,
  filterSuccess,
  isGqlQueryConfig,
  isQueryStateCancelled,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStatePrepared,
  isQueryStateSuccess,
  switchQueryState,
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
   * Used to track which components depend on this query.
   * The key is the component's _tNode index.
   * The value is the number of times the component has subscribed to this query.
   * The value might increase since we cant distinguish between a component and a host directive applied to it.
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

    const ts = this.rawState.meta.expiresAt;

    if (!ts) {
      return true;
    }

    return ts < Date.now();
  }

  get isInUse() {
    return this._state$.observed || Object.keys(this._dependents).length > 0;
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

  get store() {
    return this._queryConfig.entity?.store ?? null;
  }

  get canBeCached() {
    return shouldCacheQuery(this._queryConfig.method);
  }

  get _isInMockMode() {
    return !!this._arguments?.mock;
  }

  constructor(
    private readonly _client: QueryClient,

    /**
     * @internal
     */
    public readonly _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, Store, Data, Id>
      | GqlQueryConfig<Route, Response, Arguments, Store, Data, Id>,

    /**
     * @internal
     */
    public readonly _routeWithParams: Route,

    /**
     * @internal
     */
    public readonly _arguments: Arguments,

    /**
     * @internal
     */
    public readonly _queryStoreKey: string,
  ) {}

  execute(options: ExecuteQueryOptions = {}) {
    const { skipCache = false, _triggeredVia: triggeredVia = 'program', cancelPrevious = false } = options;
    const { authProvider } = this._client;
    const queryConfig = this._queryConfig;

    if (!this.isExpired && !skipCache && isQueryStateSuccess(this.rawState)) {
      return this;
    }

    if (queryConfig.secure && !authProvider && !this._isInMockMode) {
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

    this._updateState({ type: QueryStateType.Loading, meta });

    if (this._isInMockMode) {
      this._mockRequest({}, meta, options);
    } else {
      let goSignal = of(true);

      if (
        authProvider &&
        isBearerAuthProvider(authProvider) &&
        queryConfig.secure &&
        !isQueryStateSuccess(authProvider.currentRefreshQuery?.rawState)
      ) {
        // On page load the query might be executed before the auth provider has been initialized.
        // In this case we need to wait for the auth provider to be ready before we can execute the query.
        goSignal = combineLatest([
          // The tokens might get set without a refresh query being created (e.g.) directly after login.
          authProvider.currentRefreshQuery$.pipe(switchQueryState(), takeUntilResponse()),
          authProvider.tokens$.pipe(take(1)),
        ]).pipe(
          takeUntil(this._onAbort$),
          filter(([state, tokens]) => {
            if (state) {
              return !isQueryStateLoading(state);
            }

            return !!tokens;
          }),
          tap(([state]) => {
            if (isQueryStateFailure(state)) {
              this._updateEntityState({ type: 'failure', error: state.error, headers: {} }, meta, options);
            }
          }),
          map(() => true),
          take(1),
        );
      }

      goSignal
        .pipe(
          switchMap(() => {
            const method = computeQueryMethod({ config: queryConfig, client: this._client });
            const body = computeQueryBody({ config: queryConfig, client: this._client, args: this._arguments, method });
            const headers = computeQueryHeaders({ client: this._client, config: queryConfig, args: this._arguments });

            return request<Response>({
              urlWithParams: this._routeWithParams as string,
              method,
              body,
              headers,
              reportProgress: queryConfig.reportProgress,
              responseType: queryConfig.responseType,
              withCredentials: queryConfig.withCredentials,
              cacheAdapter: this._client.config.request?.cacheAdapter,
              retryFn: this._client.config.request?.retryFn,
            }).pipe(
              tap((state) => this._updateEntityState(state, meta, options)),
              takeUntil(this._onAbort$),
            );
          }),
        )

        .subscribe();
    }

    return this;
  }

  abort() {
    if (!isQueryStateLoading(this.rawState)) {
      return this;
    }

    this._onAbort$.next();

    this._updateState({
      type: QueryStateType.Cancelled,
      meta: { id: this.rawState.meta.id, triggeredVia: this.rawState.meta.triggeredVia },
    });

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

  onSuccess(callback: (response: Data) => void) {
    this.state$.pipe(takeUntilResponse(), filterSuccess()).subscribe((state) => callback(state.response));
    return this;
  }

  onFailure(callback: (error: RequestError<unknown>) => void) {
    this.state$.pipe(takeUntilResponse(), filterFailure()).subscribe((state) => callback(state.error));
    return this;
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

        this._updateState({
          type: QueryStateType.Loading,
          meta: newMeta,
        });
        break;
      }

      case 'upload-progress':
      case 'download-progress': {
        this._updateState({
          type: QueryStateType.Loading,
          progress: requestEvent.progress,
          partialText: 'partialText' in requestEvent ? requestEvent.partialText : undefined,
          meta,
        });

        break;
      }

      case 'success': {
        const { response, expiresInTimestamp, headers } = requestEvent;
        const isGql = isGqlQueryConfig(this._queryConfig);
        const responseData =
          isGql && typeof response === 'object' && !!response && 'data' in response
            ? (response['data'] as Response)
            : (response as Response);

        if (this._queryConfig.entity && this._queryConfig.entity.set) {
          const id = this._queryConfig.entity?.id({ args: this._arguments, response: responseData });

          this._queryConfig.entity?.set({
            args: this._arguments,
            response: responseData,
            id,
            store: this._queryConfig.entity.store,
          });
        }

        this._updateState({
          type: QueryStateType.Success,
          response: responseData,
          headers: headers,
          meta: { ...meta, expiresAt: expiresInTimestamp },
        });

        break;
      }

      case 'failure': {
        const { error } = requestEvent;
        const failure = () => this._updateState({ type: QueryStateType.Failure, error, meta });
        const bearerAuthProvider = this._getBearerAuthProvider();

        if (
          !bearerAuthProvider ||
          options?._isUnauthorizedRetry ||
          error.status !== 401 ||
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
        this._updateState({
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

    const id = this._queryConfig.entity.id({ args: this._arguments, response: s.response });

    return this._queryConfig.entity
      .get({ args: this._arguments, id, response: s.response, store: this._queryConfig.entity.store })
      .pipe(map((v) => ({ ...s, response: v })));
  }

  private _updateState(s: QueryState<Response>) {
    // We need to use untracked here to avoid Angular's "allowSignalWrites is false" error when executing queries inside Angular's computed/effect signal functions.
    untracked(() => this._state$.next(s));
  }

  private _mockRequest(headers: RequestHeaders | undefined, meta: QueryStateMeta, options: ExecuteQueryOptions) {
    if (!this._arguments?.mock) return;

    const { delay = 200, error, response, retryIntoResponse = false, progress } = this._arguments.mock;
    const progressFileSize = progress?.fileSize ?? 1000000;
    const progressEventType = progress?.eventType ?? 'upload';
    const progressEventCount = progress?.eventCount ?? 5;
    const progressOmitTotal = progress?.omitTotal ?? false;
    const omitPartialText = progress?.omitPartialText ?? false;

    const finalResolveMock = () => {
      if (error) {
        this._updateEntityState({ error, headers: headers ?? {}, type: 'failure' }, meta, options);
        return;
      }

      this._updateEntityState(
        { response: response as Response, headers: headers ?? {}, type: 'success' },
        meta,
        options,
      );
    };

    if (progress) {
      interval(delay)
        .pipe(
          tap((a) => {
            if (a === progressEventCount + 1) {
              finalResolveMock();
            } else {
              const current = Math.min(progressFileSize * a, progressFileSize * progressEventCount);
              const percentage = (current / (progressFileSize * progressEventCount)) * 100;

              this._updateEntityState(
                {
                  type: progressEventType === 'upload' ? 'upload-progress' : 'download-progress',
                  headers: headers ?? {},
                  progress: { current, ...(progressOmitTotal ? {} : { percentage, total: progressFileSize }) },
                  partialText: omitPartialText ? undefined : `Partial text ${a}`,
                },
                meta,
                options,
              );
            }
          }),
          takeUntil(this._onAbort$),
          takeWhile((a) => a < progressEventCount + 1, true),
        )
        .subscribe();
    } else if (retryIntoResponse) {
      interval(delay)
        .pipe(
          tap((a) => {
            if (a === 3) {
              finalResolveMock();
            } else {
              const aModified = a + 1;
              this._updateEntityState(
                {
                  type: 'delay-retry',
                  headers: headers ?? {},
                  retryDelay: 1000 + 1000 * aModified,
                  retryNumber: aModified,
                },
                meta,
                options,
              );
            }
          }),
          takeUntil(this._onAbort$),
          takeWhile((a) => a < 3, true),
        )
        .subscribe();
    } else {
      timer(delay)
        .pipe(
          tap(() => finalResolveMock()),
          takeUntil(this._onAbort$),
        )
        .subscribe();
    }
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
