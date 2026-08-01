import { HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpProgressEvent } from '@angular/common/http';
import { ErrorHandler, Signal, signal } from '@angular/core';
import { Observable, Subject, Subscription, catchError, retry, tap, throwError, timer } from 'rxjs';
import { buildTimestampFromSeconds } from './internal/request-route';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { extractExpiresInSeconds } from './query-cache-utils';
import { CacheAdapterFn } from './query-client';
import { CreateQueryCreatorOptions, QueryMethod } from './query-creator';
import { QueryErrorResponse, createQueryErrorResponse } from './query-error-response';
import { QueryRepositoryDependencies } from './query-repository';
import { ShouldRetryRequestFn, ShouldRetryRequestOptions, shouldRetryRequest } from './query-retry-utils';

export const SPEED_BUFFER_TIME_IN_MS = 2000;

export type HttpRequestTransferCacheConfig =
  | boolean
  | {
      includeHeaders?: string[];
    };

export type HttpRequestResponseType = 'json' | 'text' | 'blob' | 'arraybuffer';

export type CreateHttpRequestDependencies = {
  /** The http client instance to use for the request */
  httpClient: HttpClient;

  /** The error handler instance to use for the request */
  ngErrorHandler: ErrorHandler;
};

export type CreateHttpRequestOptions<TArgs extends QueryArgs> = {
  /** The HTTP method of the request */
  method: QueryMethod;

  /**
   * The full path of the request
   * @example 'https://api.example.com/v1/users'
   */
  fullPath: string;

  /** The data of the request */
  args?: RequestArgs<TArgs> | null;

  /** The dependencies of the request */
  dependencies: QueryRepositoryDependencies;

  /** The client options of the request */
  clientOptions?: CreateQueryCreatorOptions;

  /**
   * Headers configured on the query client, applied to every request it makes. Per-request
   * `args.headers` are merged on top and win per header name.
   *
   * @see CreateQueryClientConfigOptions.headers
   */
  clientHeaders?: HttpHeaders | (() => HttpHeaders);

  /**
   * The cache adapter function to use for the request
   * @default extractExpiresInSeconds()
   */
  cacheAdapter?: CacheAdapterFn;

  /**
   * The retry function to use for the request
   * @default shouldRetryRequest()
   */
  retryFn?: ShouldRetryRequestFn;
};

export type HttpRequestLoadingState = {
  /** The time when the request was executed in ms */
  executeTime: number;

  /** The progress of the request. Null if reportProgress is false or progress is not available / unsupported */
  progress: HttpRequestLoadingProgressState | null;
};

export type HttpRequestLoadingProgressState = {
  /** The total number of bytes to be transferred */
  total: number;

  /** The number of bytes transferred */
  loaded: number;

  /** The percentage of the transfer that is completed */
  percentage: number;

  /** The speed of the transfer in bytes per millisecond */
  speed: number | null;

  /** The estimated remaining time in milliseconds */
  remainingTime: number | null;
};

/**
 * Advanced request internals. **Not part of the general public contract** - do not build
 * application logic on top of these.
 */
export type HttpRequestSubtle<TArgs extends QueryArgs> = {
  /**
   * Adopts a response this request never made itself - the same request settled in another tab and
   * its result arrived over the multi-tab sync channel.
   *
   * Deliberately silent: it writes the state signals but emits nothing on {@link HttpRequest.events$}
   * (and leaves {@link HttpRequest.currentEvent} alone), because that stream means "this request
   * settled over HTTP". The repository's `request-success` event - which is what broadcasts in the
   * first place - hangs off it, so emitting here would bounce the response back and forth between
   * tabs forever. The cost is that event-driven features (`withSuccessHandling`, `withLogging`) stay
   * quiet for shared responses; everything signal-driven updates as usual.
   *
   * `loading` is left untouched: the caller is responsible for not applying over an in-flight
   * request, and clearing it here would claim a request finished when it has not.
   */
  applyExternalResponse: (options: { body: ResponseType<TArgs>; expiresAt: number | null }) => void;

  /**
   * When this request last adopted a response from another tab, or `null` if it never did. Read by the
   * query devtools to show which entries are being kept up to date from elsewhere.
   */
  lastExternalResponseAt: Signal<number | null>;

  /**
   * Adopts a response from a previous session, read back from the client's persisted store while this
   * request is on its way - so a reload (or a cold start with no network) renders the last known data
   * instead of an empty loading state.
   *
   * Silent for the same reason as {@link applyExternalResponse}: `events$` means "this request settled
   * over HTTP", and the repository's `request-success` hangs off it, so emitting here would both
   * re-persist and broadcast a disk read.
   *
   * Unlike `applyExternalResponse` it leaves {@link HttpRequest.error} alone. Hydration commonly
   * happens *after* the request it revalidates with has already failed - that is the offline case - and
   * clearing the error there would report a failed revalidation as a success.
   */
  applyPersistedResponse: (options: { body: ResponseType<TArgs>; expiresAt: number | null }) => void;

  /**
   * When this request adopted a response from the persisted store, or `null` if it never did. Read by
   * the query devtools to show which entries are showing data from a previous session.
   */
  lastPersistedResponseAt: Signal<number | null>;
};

export type HttpRequest<TArgs extends QueryArgs> = {
  /** The HTTP method of the request. */
  method: QueryMethod;

  /** The full URL of the request (base + path + query params). */
  url: string;

  /**
   * Executes the request.
   *
   * `force` runs it even when one is already in flight (the in-flight one is cancelled) or the
   * cached response is still fresh - used by `refreshQueriesInUse` after something outside the
   * request changed, such as a client-level header.
   */
  execute: (options?: { allowCache?: boolean; force?: boolean }) => boolean;

  /** Destroys the request (cancels it if in progress) */
  destroy: () => boolean;

  /** The loading state of the request */
  loading: Signal<HttpRequestLoadingState | null>;

  /** The error state of the request */
  error: Signal<QueryErrorResponse | null>;

  /** The response state of the request */
  response: Signal<ResponseType<TArgs> | null>;

  /** The current event of the request */
  currentEvent: Signal<RequestHttpEvent<TArgs> | null>;

  /**
   * A discrete stream of every event of this request, emitted synchronously at the moment the
   * event is processed (including the terminal Response / error event). Unlike the `currentEvent`
   * signal, this never coalesces or gets reset, so consumers cannot miss a transition. Completes
   * when the request is destroyed.
   */
  events$: Observable<RequestHttpEvent<TArgs>>;

  /**
   * Whether the request is stale or not aka the cache header has expired.
   *
   * This is a plain getter function (evaluated on each call), not a reactive signal, because
   * staleness depends on wall-clock time rather than on any tracked signal.
   */
  isStale: () => boolean;

  /**
   * The timestamp (ms) at which the cached response goes stale, or `null` when the request is not
   * cacheable / has no freshness window. Exposed for devtools freshness countdowns.
   */
  expiresAt: Signal<number | null>;

  /** Advanced request internals. */
  subtle: HttpRequestSubtle<TArgs>;
};

/** A custom error event since the Angular http client does not provide a specific event for errors */
export type HttpErrorEvent = {
  type: 'error';
  error: QueryErrorResponse;
};

export type RequestHttpEvent<TArgs extends QueryArgs> = HttpEvent<ResponseType<TArgs>> | HttpErrorEvent;

export const createHttpRequest = <TArgs extends QueryArgs>(options: CreateHttpRequestOptions<TArgs>) => {
  let currentStreamSubscription = Subscription.EMPTY;

  const { args, clientOptions, dependencies } = options;

  const currentEvent = signal<RequestHttpEvent<TArgs> | null>(null);
  const event$ = new Subject<RequestHttpEvent<TArgs>>();
  const loading = signal<HttpRequestLoadingState | null>(null);
  const error = signal<QueryErrorResponse | null>(null);
  const response = signal<ResponseType<TArgs> | null>(null);

  const lastLoadEventTime = signal(0);
  const lastLoadEventAmount = signal(0);
  const lastExecuteTime = signal(0);
  const expiresIn = signal<number | null>(null);

  // NOTE: This must be a plain function, not a `computed`. The freshness check compares against
  // `Date.now()`, which is not reactive, so a memoized computed would only ever recompute when
  // `expiresIn` changes - once it evaluated to `false` (fresh) it would stay `false` forever, even
  // after the window elapsed, turning every `allowCache` execute into a permanent cache hit.
  const isStale = () => {
    const expiresInTs = expiresIn();

    return expiresInTs === null || expiresInTs < Date.now();
  };

  // Resolved per execution rather than once at creation, so a client whose headers are a function
  // reading a signal (a preview token, a tenant id) sees the current value on every re-run.
  const resolveHeaders = () => {
    const clientHeaders = typeof options.clientHeaders === 'function' ? options.clientHeaders() : options.clientHeaders;
    const argHeaders = typeof args?.headers === 'function' ? args.headers() : args?.headers;

    if (!clientHeaders) return argHeaders;
    if (!argHeaders) return clientHeaders;

    // `set` replaces every value of that name, so a per-request header fully overrides the
    // client-level one instead of being appended next to it.
    return argHeaders.keys().reduce((merged, key) => merged.set(key, argHeaders.getAll(key) ?? []), clientHeaders);
  };

  const createStream = () => {
    const headers = resolveHeaders();

    return dependencies.httpClient
      .request(options.method, options.fullPath, {
        observe: 'events',
        body: args?.body,
        reportProgress: clientOptions?.reportProgress,
        withCredentials: clientOptions?.withCredentials,
        transferCache: clientOptions?.transferCache,
        responseType: clientOptions?.responseType || 'json',
        headers,
      })
      .pipe(
        tap((event) => updateState(event)),
        retry({
          delay: (error, retryCount) => {
            const retryOptions: ShouldRetryRequestOptions = { error, retryCount };

            const retryResult = options.retryFn?.(retryOptions) || shouldRetryRequest(retryOptions);

            if (!retryResult.retry) {
              return throwError(() => error);
            }

            return timer(retryResult.delay);
          },
        }),
        catchError((e) => {
          updateErrorState(e);

          return throwError(() => e);
        }),
      );
  };

  const execute = (options?: { allowCache?: boolean; force?: boolean }) => {
    if (!options?.force && (loading() || (!isStale() && options?.allowCache))) {
      // Do not execute if there is already a request in progress or caching is allowed
      return false;
    }

    currentStreamSubscription.unsubscribe();

    lastExecuteTime.set(Date.now());
    lastLoadEventTime.set(lastExecuteTime());

    loading.set({
      executeTime: lastExecuteTime(),
      progress: null,
    });
    error.set(null);
    expiresIn.set(null);

    const stream = createStream();

    currentStreamSubscription = stream.subscribe({
      error: () => {
        // Errors are already handled in updateErrorState via catchError
        // This empty handler prevents "unhandled error" warnings in tests
      },
    });

    return true;
  };

  const destroy = () => {
    const wasActive = !currentStreamSubscription.closed;

    currentStreamSubscription.unsubscribe();
    event$.complete();

    return wasActive;
  };

  const updateState = (event: HttpEvent<ResponseType<TArgs>>) => {
    switch (event.type) {
      case HttpEventType.Response:
        {
          loading.set(null);
          response.set(event.body);

          const expiresInSeconds = options.cacheAdapter
            ? options.cacheAdapter(event.headers)
            : extractExpiresInSeconds(event.headers);
          const expiresInTimestamp = buildTimestampFromSeconds(expiresInSeconds);
          expiresIn.set(expiresInTimestamp);
        }
        break;

      case HttpEventType.UploadProgress:
      case HttpEventType.DownloadProgress:
        {
          updateLoadingState(event);
        }
        break;

      case HttpEventType.Sent:
      case HttpEventType.ResponseHeader:
      case HttpEventType.User:
        {
          // we don't care about these events
        }
        break;
    }

    currentEvent.set(event);
    event$.next(event);
  };

  const updateErrorState = (errorResponse: unknown) => {
    const errorRes = createQueryErrorResponse(errorResponse);

    error.set(errorRes);
    loading.set(null);

    const errorEvent: HttpErrorEvent = { type: 'error', error: errorRes };
    currentEvent.set(errorEvent);
    event$.next(errorEvent);

    options.dependencies.ngErrorHandler.handleError(errorRes.raw);
  };

  const updateLoadingState = (event: HttpProgressEvent) => {
    if (event.total === undefined) {
      return;
    }

    const progress: HttpRequestLoadingProgressState = {
      total: event.total,
      loaded: event.loaded,
      percentage: (event.loaded / event.total) * 100,
      speed: null,
      remainingTime: null,
    };

    const state: HttpRequestLoadingState = {
      executeTime: lastExecuteTime(),
      progress,
    };

    const currentTime = Date.now();
    const elapsedTimeSinceLastEvent = currentTime - lastLoadEventTime();
    const elapsedTimeSinceLastExecute = currentTime - lastExecuteTime();
    const loadedAmount = event.loaded - lastLoadEventAmount();

    // We only want to calculate speed and remaining time after 2 seconds of the execution
    // This is to avoid showing incorrect speed and remaining time when the request is very fast
    if (elapsedTimeSinceLastExecute > SPEED_BUFFER_TIME_IN_MS) {
      const speed = (loadedAmount / elapsedTimeSinceLastEvent) * 1000;

      progress.speed = speed * 1000;
      progress.remainingTime = Math.round((event.total - event.loaded) / speed) * 1000;
    }

    lastLoadEventTime.set(currentTime);
    lastLoadEventAmount.set(event.loaded);

    loading.set(state);
  };

  const lastExternalResponseAt = signal<number | null>(null);

  const applyExternalResponse = (externalResponse: { body: ResponseType<TArgs>; expiresAt: number | null }) => {
    response.set(externalResponse.body);
    expiresIn.set(externalResponse.expiresAt);
    error.set(null);
    lastExternalResponseAt.set(Date.now());
  };

  const lastPersistedResponseAt = signal<number | null>(null);

  const applyPersistedResponse = (persistedResponse: { body: ResponseType<TArgs>; expiresAt: number | null }) => {
    response.set(persistedResponse.body);
    expiresIn.set(persistedResponse.expiresAt);
    lastPersistedResponseAt.set(Date.now());
  };

  const httpRequest: HttpRequest<TArgs> = {
    method: options.method,
    url: options.fullPath,
    execute,
    destroy,
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    response: response.asReadonly(),
    currentEvent: currentEvent.asReadonly(),
    events$: event$.asObservable(),
    isStale,
    expiresAt: expiresIn.asReadonly(),
    subtle: {
      applyExternalResponse,
      lastExternalResponseAt: lastExternalResponseAt.asReadonly(),
      applyPersistedResponse,
      lastPersistedResponseAt: lastPersistedResponseAt.asReadonly(),
    },
  };

  return httpRequest;
};
