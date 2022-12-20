import { BehaviorSubject, interval, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { transformGql } from '../gql';
import { DefaultResponseTransformer, QueryClient, ResponseTransformerType } from '../query-client';
import {
  buildBody,
  guessContentType,
  isAbortRequestError,
  isRequestError,
  Method as MethodType,
  request,
  transformMethod,
} from '../request';
import {
  BaseArguments,
  GqlQueryConfig,
  PollConfig,
  QueryState,
  QueryStateMeta,
  QueryStateType,
  RestQueryConfig,
  RouteType,
  RunQueryOptions,
  WithUseResultIn,
} from './query.types';
import {
  filterSuccess,
  isGqlQueryConfig,
  isQueryStateLoading,
  isQueryStateSuccess,
  mergeHeaders,
  takeUntilResponse,
} from './query.utils';

export class Query<
  Response,
  Arguments extends (BaseArguments & WithUseResultIn<Response, ResponseTransformer>) | undefined,
  Route extends RouteType<Arguments>,
  Method extends MethodType,
  ResponseTransformer extends ResponseTransformerType<Response> = DefaultResponseTransformer<Response>,
> {
  private _currentId = 0;
  private _abortController = new AbortController();
  private _pollingSubscription: Subscription | null = null;
  private _onAbort$ = new Subject<void>();

  private readonly _state$: BehaviorSubject<QueryState<ReturnType<ResponseTransformer>, Response>>;

  private get _nextId() {
    return this._currentId++;
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

  constructor(
    private _client: QueryClient,
    private _queryConfig:
      | RestQueryConfig<Route, Response, Arguments, ResponseTransformer>
      | GqlQueryConfig<Route, Response, Arguments, ResponseTransformer>,
    private _route: Route,
    private _args: Arguments | undefined,
  ) {
    this._state$ = new BehaviorSubject<QueryState<ReturnType<ResponseTransformer>, Response>>({
      type: QueryStateType.Prepared,
      meta: { id: this._currentId },
    });
  }

  clone() {
    return this._client.fetch<Route, Response, Arguments, Method, ResponseTransformer>(this._queryConfig);
  }

  execute<ComputedResponse extends ReturnType<ResponseTransformer>>(options?: RunQueryOptions) {
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

    const meta = { id };

    this._state$.next({
      type: QueryStateType.Loading,
      meta,
    });

    this._updateUseResultInDependencies();

    let body: string | FormData | null = null;
    let contentType: string | null = null;

    if (isGqlQueryConfig(this._queryConfig)) {
      const queryTemplate = this._queryConfig.query;
      const query = transformGql(queryTemplate);

      contentType = 'application/json';
      body = query(this._args?.variables);
    } else {
      body = buildBody(this._args?.body);
      contentType = guessContentType(this._args?.body);
    }

    let authHeader: Record<string, string> | null = null;

    if (this._queryConfig.secure) {
      const header = this._client.authProvider?.header;

      if (header) {
        authHeader = header;
      }
    } else if (this._client.authProvider?.header) {
      if (this._queryConfig.secure === undefined || this._queryConfig.secure) {
        authHeader = this._client.authProvider.header;
      }
    }

    let headers = mergeHeaders(authHeader, this._args?.headers);

    if (contentType && !headers?.['Content-Type'] && !headers?.['content-type']) {
      if (headers) {
        headers['Content-Type'] = contentType;
      } else {
        headers = {
          'Content-Type': contentType,
        };
      }
    }

    request<Response>({
      route: this._route,
      init: {
        method: transformMethod(this._queryConfig.method),
        signal: this._abortController.signal,
        body,
        headers: headers || undefined,
      },
      cacheAdapter: this._client.config.request?.cacheAdapter,
    })
      .then((response) => {
        const isResponseObject = typeof response === 'object';

        const isGql = isGqlQueryConfig(this._queryConfig);

        let responseData: Response | null = null;
        if (
          isGql &&
          isResponseObject &&
          !!response.data &&
          typeof response.data === 'object' &&
          'data' in response.data
        ) {
          responseData = (response.data as Record<string, unknown>)['data'] as Response;
        } else {
          responseData = response.data as Response;
        }

        const transformedResponse = this._queryConfig.responseTransformer
          ? this._queryConfig.responseTransformer(responseData)
          : responseData;

        this._state$.next({
          type: QueryStateType.Success,
          response: transformedResponse as ComputedResponse,
          rawResponse: responseData as Response,
          meta: { ...meta, expiresAt: response.expiresInTimestamp },
        });
      })
      .catch((error) => this._handleExecuteError(error, meta));

    return this;
  }

  abort() {
    this._abortController.abort();
    this._abortController = new AbortController();
    this._onAbort$.next();

    return this;
  }

  poll(config: PollConfig) {
    if (this._pollingSubscription) {
      return this;
    }

    this._pollingSubscription = interval(config.interval)
      .pipe(takeUntil(config.takeUntil))
      .subscribe(() => this.execute({ skipCache: true }));

    return this;
  }

  stopPolling() {
    this._pollingSubscription?.unsubscribe();
    this._pollingSubscription = null;

    return this;
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

  private _handleExecuteError(error: unknown, meta: QueryStateMeta) {
    if (isAbortRequestError(error)) {
      this._state$.next({
        type: QueryStateType.Cancelled,
        meta,
      });
    } else if (isRequestError(error)) {
      this._state$.next({
        type: QueryStateType.Failure,
        error,
        meta,
      });
    } else {
      throw error;
    }
  }
}
