import { EffectRef, effect, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  defer,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  ReplaySubject,
  shareReplay,
  startWith,
  Subscription,
  switchMap,
  takeUntil,
  takeWhile,
  timer,
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
  QueryStateMeta,
  QueryStateType,
  QueryTrigger,
  Success,
  takeUntilResponse,
  V2QueryState,
  V2RouteType,
} from '../query';
import { RequestError } from '../request';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export type CreateLegacyQueryOptions<TArgs extends QueryArgs> = {
  query: Query<TArgs>;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const transformExecStateToQueryState = <TArgs extends QueryArgs>(
  execState: QueryExecutionState<TArgs> | null,
  triggeredVia: QueryTrigger = 'program',
): V2QueryState<ResponseType<TArgs>> => {
  const meta: QueryStateMeta = { id: -1, triggeredVia };

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

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export const isLegacyQuery = <T extends AnyLegacyQuery>(query: unknown): query is T => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return false;
  }

  if (!('newQuery' in query)) {
    return false;
  }

  return true;
};

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLegacyQuery = LegacyQuery<any, any, any, any, any, any, any>;

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export class LegacyQuery<
  Response,
  Arguments extends BaseArguments | undefined,
  // Positional public-API generic slot - consumers infer it via `LegacyQuery<…, infer Route, …>`,
  // so it must stay even though the class body never references it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Route extends V2RouteType<Arguments>,
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
   * `null` for an inert query - there is no live injector to own an effect.
   *
   * @internal
   */
  storeSyncEffect: EffectRef | null = null;

  /**
   * @internal
   */
  readonly _dependents: Record<number, number> = {};

  /**
   * @internal
   */
  _dependentsChanged$ = new ReplaySubject<Record<number, number>>();

  /**
   * @internal
   */
  _isPollingPaused = false;

  private isDestroyed = false;

  private _triggeredVia: QueryTrigger = 'program';

  private _wasAborted = false;

  state$: Observable<V2QueryState<Data>>;

  constructor(
    public newQuery: TNewQuery,
    public _arguments: RequestArgs<QueryArgsOf<TNewQuery>>,
    public entity?: QueryEntityConfig<Store, Data, Response, Arguments, Id>,

    /**
     * Wraps an inert query - see `createInertQuery`. Skips everything that needs a live injector,
     * so the wrapper is safe to build during teardown.
     *
     * @internal
     */
    private _isInert = false,

    /**
     * Whether the underlying request is cacheable. Resolved by the creator, which is the only place that
     * knows the method before the first execution.
     *
     * @internal
     */
    private _canBeCached = false,
  ) {
    if (this._isInert) {
      this.state$ = of(transformExecStateToQueryState(null)) as Observable<V2QueryState<Data>>;
      this.isDestroyed = true;

      return;
    }

    // `toObservable` first emits from an effect, so a subscriber that attaches and calls `execute()` in the
    // same turn would otherwise never see the Prepared state `legacy.md` promises. The source is created
    // here, not inside the `defer`: its effect has to be registered before `storeSyncEffect` and the
    // `destroyOnResponse` teardown below, or a self-destroying query dies before its Success is published.
    const executionState$ = toObservable(this.newQuery.executionState, { injector: this.newQuery.subtle.injector });

    this.state$ = defer(() => executionState$.pipe(startWith(untracked(this.newQuery.executionState)))).pipe(
      distinctUntilChanged(),
      map((execState) => this.toQueryState(execState)),
      switchMap((s) => this._transformState(s)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.storeSyncEffect = effect(() => {
      // Gated on the execution state, not on the response being non-null: the effect runs once on
      // creation, and `response()` is null until the first one arrives - `id`/`set` are typed
      // non-nullable, so an unguarded write feeds `null` through them on every `prepare()`. A plain
      // null-check would be wrong the other way: a 204 is a success whose body is legitimately null.
      const execState = this.newQuery.executionState();

      untracked(() => {
        if (execState?.type !== 'success' || !this.entity?.set) return;

        const res = execState.response;
        const id = this.entity.id({ args: this._arguments, response: res });

        this.entity.set({
          args: this._arguments,
          response: res,
          id,
          store: this.entity.store,
        });
      });
    });

    // Tear down only what this wrapper owns. The underlying query is already being destroyed when this fires, so
    // destroying it again would call `R3Injector.destroy()` on an injector that is mid-teardown, which throws
    // NG0205 ("Injector has already been destroyed") from inside the view's cleanup phase.
    this.newQuery.subtle.destroyRef.onDestroy(() => this.teardown());
  }

  get rawState() {
    return this.toQueryState(this.newQuery.executionState());
  }

  /**
   * `abort()` resets the underlying query, so it holds no execution state - the shape of a query that has
   * never run. The abort flag is the only thing that tells the two apart.
   */
  private toQueryState(execState: QueryExecutionState<QueryArgsOf<TNewQuery>> | null) {
    const state = transformExecStateToQueryState(execState, this._triggeredVia);

    if (execState || !this._wasAborted) {
      return state;
    }

    return { type: QueryStateType.Cancelled, meta: state.meta };
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
    return this._canBeCached;
  }

  get _isInMockMode() {
    return false;
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.teardown();

    // Re-enters `_teardown` through the query's `destroyRef`, which the `_isDestroyed` guard absorbs.
    this.newQuery.subtle.destroy();
  }

  execute(options: ExecuteQueryOptions = {}) {
    if (isQueryStateLoading(this.rawState)) {
      if (options.cancelPrevious !== true) {
        return this;
      }

      this.abort();
    }

    this._triggeredVia = options._triggeredVia ?? 'program';
    this._wasAborted = false;

    untracked(() =>
      // v2 had a single `skipCache` for every method, so this cannot tell whether the underlying request is
      // cacheable. The creator is built with `silenceUncacheableAllowCacheError`, which makes `allowCache` inert
      // on a mutation instead of throwing ET301.
      this.newQuery.execute({ args: this._arguments, options: { allowCache: options.skipCache !== true } }),
    );

    return this;
  }

  abort() {
    if (!isQueryStateLoading(this.rawState)) {
      return this;
    }

    this._wasAborted = true;
    this.newQuery.reset();

    return this;
  }

  poll(config: PollConfig) {
    // An inert or already destroyed query has nothing to poll, and the interval would outlive it.
    if (this._pollingSubscription || this.isDestroyed) {
      return this;
    }

    this._currentPollConfig = config;

    const poll$ = timer(config.triggerImmediately ? 0 : config.interval, config.interval).pipe(
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
  _transformState(s: V2QueryState<Response>): Observable<V2QueryState<Data>> {
    if (!isQueryStateSuccess(s) || !this.entity?.get) {
      return of(s) as Observable<V2QueryState<Data>>;
    }

    const id = this.entity.id({ args: this._arguments, response: s.response });

    return this.entity
      .get({ args: this._arguments, id, response: s.response, store: this.entity.store })
      .pipe(map((v) => ({ ...s, response: v })));
  }

  private teardown() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;
    this._dependentsChanged$.complete();
    this.storeSyncEffect?.destroy();
  }
}
