/* eslint-disable @typescript-eslint/no-empty-function */

import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpProgressEvent,
} from '@angular/common/http';
import { Signal, computed, signal } from '@angular/core';
import { buildTimestampFromSeconds } from '@ethlete/query';
import { Subscription, catchError, retry, tap, throwError, timer } from 'rxjs';
import { BodyType, PathParamsType, QueryArgs, QueryParamsType, ResponseType } from './query';
import { CacheAdapterFn } from './query-client-config';
import { QueryMethod } from './query-creator';
import {
  ShouldRetryRequestFn,
  ShouldRetryRequestOptions,
  extractExpiresInSeconds,
  shouldRetryRequest,
} from './query-utils';

export const SPEED_BUFFER_TIME_IN_MS = 2000;

export type CreateHttpRequestOptions<TArgs extends QueryArgs> = {
  method: QueryMethod;
  fullPath: string;
  pathParams?: PathParamsType<TArgs>;
  queryParams?: QueryParamsType<TArgs>;
  body?: BodyType<TArgs>;
  reportProgress?: boolean;
  withCredentials?: boolean;
  transferCache?: boolean | { includeHeaders?: string[] };
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';

  context?: HttpContext;
  headers?: HttpHeaders;

  httpClient: HttpClient;

  cacheAdapter?: CacheAdapterFn;
  retryFn?: ShouldRetryRequestFn;
};

export type HttpRequestLoadingState = {
  executeTime: number;
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
  execute: () => void;
  destroy: () => void;
  loading: Signal<HttpRequestLoadingState | null>;
  error: Signal<HttpErrorResponse | null>;
  response: Signal<ResponseType<TArgs> | null>;
  currentEvent: Signal<HttpEvent<ResponseType<TArgs>> | HttpErrorEvent | null>;
};

export type HttpErrorEvent = {
  type: 'error';
  error: HttpErrorResponse;
};

export const createHttpRequest = <TArgs extends QueryArgs>(options: CreateHttpRequestOptions<TArgs>) => {
  let currentStreamSubscription = Subscription.EMPTY;

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

  const stream = options.httpClient
    .request(options.method, options.fullPath, {
      observe: 'events',
      body: options.body,
      reportProgress: options.reportProgress,
      withCredentials: options.withCredentials,
      transferCache: options.transferCache,
      responseType: options.responseType || 'json',
      context: options.context,
      headers: options.headers,
    })
    .pipe(
      tap((event) => updateState(event)),
      retry({
        delay: (error, retryCount) => {
          const retryOptions: ShouldRetryRequestOptions = { error, retryCount };
          const retryResult = options.retryFn?.(retryOptions) ?? shouldRetryRequest(retryOptions);

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

  const execute = () => {
    if (loading() || !isStale()) {
      // Do not execute if there is already a request in progress or the request is not stale
      return;
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
  };

  const destroy = () => {
    currentStreamSubscription.unsubscribe();
  };

  const updateState = (event: HttpEvent<ResponseType<TArgs>>) => {
    currentEvent.set(event);

    switch (event.type) {
      case HttpEventType.Response:
        {
          loading.set(null);
          response.set(event.body);

          const expiresInSeconds = options.cacheAdapter?.(event.headers) ?? extractExpiresInSeconds(event.headers);
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
    if (!(errorResponse instanceof HttpErrorResponse)) {
      errorResponse = new HttpErrorResponse({
        error: errorResponse,
        status: 0,
        statusText: 'Unknown Error',
      });
    } else {
      error.set(errorResponse);
    }

    loading.set(null);
    currentEvent.set({ type: 'error', error: errorResponse as HttpErrorResponse });
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
  };

  return httpRequest;
};
