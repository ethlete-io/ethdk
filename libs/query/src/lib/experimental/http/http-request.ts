import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpProgressEvent,
} from '@angular/common/http';
import { Signal, computed, signal } from '@angular/core';
import { Subscription, catchError, retry, tap, throwError, timer } from 'rxjs';
import { buildTimestampFromSeconds } from '../../request';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { CacheAdapterFn } from './query-client-config';
import { QueryMethod } from './query-creator';
import {
  ShouldRetryRequestFn,
  ShouldRetryRequestOptions,
  extractExpiresInSeconds,
  shouldRetryRequest,
} from './query-utils';

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
};

export type CreateHttpRequestClientOptions = {
  /**
   * Whether to report the progress of the request or not. If the fetch backend is used, this will only work for downloads.
   * @see https://angular.dev/guide/http/making-requests#receiving-raw-progress-events
   * @default false
   */
  reportProgress?: boolean;

  /**
   * Whether to include credentials in the request or not
   * @default false
   */
  withCredentials?: boolean;

  /**
   * This property accepts either a boolean to enable/disable transferring cache for eligible
   * requests performed using `HttpClient`, or an object, which allows to configure cache
   * parameters, such as which headers should be included (no headers are included by default).
   *
   * Setting this property will override the options passed to `provideClientHydration()` for this
   * particular request
   */
  transferCache?: HttpRequestTransferCacheConfig;

  /**
   * The response type of the request
   * @default 'json'
   */
  responseType?: HttpRequestResponseType;

  /**
   * The context of the request
   * @default undefined
   * @see https://angular.dev/guide/http/interceptors#request-and-response-metadata
   */
  context?: HttpContext;
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
  dependencies: CreateHttpRequestDependencies;

  /** The client options of the request */
  clientOptions?: CreateHttpRequestClientOptions;

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

export type HttpRequest<TArgs extends QueryArgs> = {
  /** Executes the request */
  execute: (options?: { allowCache?: boolean }) => boolean;

  /** Destroys the request (cancels it if in progress) */
  destroy: () => boolean;

  /** The loading state of the request */
  loading: Signal<HttpRequestLoadingState | null>;

  /** The error state of the request */
  error: Signal<HttpErrorResponse | null>;

  /** The response state of the request */
  response: Signal<ResponseType<TArgs> | null>;

  /** The current event of the request */
  currentEvent: Signal<HttpEvent<ResponseType<TArgs>> | HttpErrorEvent | null>;

  /** Whether the request is stale or not aka the cache header has expired */
  isStale: Signal<boolean>;
};

/** A custom error event since the Angular http client does not provide a specific event for errors */
export type HttpErrorEvent = {
  type: 'error';
  error: HttpErrorResponse;
};

export const createHttpRequest = <TArgs extends QueryArgs>(options: CreateHttpRequestOptions<TArgs>) => {
  let currentStreamSubscription = Subscription.EMPTY;

  const { args, clientOptions, dependencies } = options;

  const currentEvent = signal<HttpEvent<ResponseType<TArgs>> | HttpErrorEvent | null>(null);
  const loading = signal<HttpRequestLoadingState | null>(null);
  const error = signal<HttpErrorResponse | null>(null);
  const response = signal<ResponseType<TArgs> | null>(null);

  const lastLoadEventTime = signal(0);
  const lastLoadEventAmount = signal(0);
  const lastExecuteTime = signal(0);
  const expiresIn = signal<number | null>(null);

  const isStale = computed(() => {
    const expiresInTs = expiresIn();

    return expiresInTs === null || expiresInTs < Date.now();
  });

  const stream = dependencies.httpClient
    .request(options.method, options.fullPath, {
      observe: 'events',
      body: args?.body,
      reportProgress: clientOptions?.reportProgress,
      withCredentials: clientOptions?.withCredentials,
      transferCache: clientOptions?.transferCache,
      responseType: clientOptions?.responseType || 'json',
      context: clientOptions?.context,
      headers: args?.headers,
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

  const execute = (options?: { allowCache?: boolean }) => {
    if (loading() || (!isStale() && options?.allowCache)) {
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

    currentStreamSubscription = stream.subscribe();

    return true;
  };

  const destroy = () => {
    if (currentStreamSubscription.closed) {
      return false;
    }

    currentStreamSubscription.unsubscribe();

    return true;
  };

  const updateState = (event: HttpEvent<ResponseType<TArgs>>) => {
    currentEvent.set(event);

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
  };

  const updateErrorState = (errorResponse: unknown) => {
    let err = errorResponse instanceof HttpErrorResponse ? errorResponse : null;

    if (!err) {
      err = new HttpErrorResponse({
        error: errorResponse,
        status: 0,
        statusText: 'Unknown Error',
      });
    }

    error.set(err);
    loading.set(null);
    currentEvent.set({ type: 'error', error: err });
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

  const httpRequest: HttpRequest<TArgs> = {
    execute,
    destroy,
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    response: response.asReadonly(),
    currentEvent: currentEvent.asReadonly(),
    isStale,
  };

  return httpRequest;
};
