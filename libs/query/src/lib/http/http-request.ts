import { HttpClient, HttpEvent, HttpEventType, HttpProgressEvent } from '@angular/common/http';
import { ErrorHandler, Signal, computed, signal } from '@angular/core';
import { Subscription, catchError, retry, tap, throwError, timer } from 'rxjs';
import { buildTimestampFromSeconds } from '../legacy/request';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { CacheAdapterFn } from './query-client';
import { CreateQueryCreatorOptions, QueryMethod } from './query-creator';
import { QueryErrorResponse, createQueryErrorResponse } from './query-error-response';
import { QueryRepositoryDependencies } from './query-repository';
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
  error: Signal<QueryErrorResponse | null>;

  /** The response state of the request */
  response: Signal<ResponseType<TArgs> | null>;

  /** The current event of the request */
  currentEvent: Signal<RequestHttpEvent<TArgs> | null>;

  /** Whether the request is stale or not aka the cache header has expired */
  isStale: Signal<boolean>;
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
  const loading = signal<HttpRequestLoadingState | null>(null);
  const error = signal<QueryErrorResponse | null>(null);
  const response = signal<ResponseType<TArgs> | null>(null);

  const lastLoadEventTime = signal(0);
  const lastLoadEventAmount = signal(0);
  const lastExecuteTime = signal(0);
  const expiresIn = signal<number | null>(null);

  const isStale = computed(() => {
    const expiresInTs = expiresIn();

    return expiresInTs === null || expiresInTs < Date.now();
  });

  const createStream = () => {
    const headers = typeof args?.headers === 'function' ? args.headers() : args?.headers;

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
    const errorRes = createQueryErrorResponse(errorResponse);

    error.set(errorRes);
    loading.set(null);
    currentEvent.set({ type: 'error', error: errorRes });

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
