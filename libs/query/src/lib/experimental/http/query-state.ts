import { HttpEvent } from '@angular/common/http';
import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { HttpRequest, HttpRequestLoadingState } from './http-request';
import { QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryErrorResponse } from './query-error-response';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SetupQueryStateOptions = {};

export type QueryStateSubtle<TArgs extends QueryArgs> = {
  request: WritableSignal<HttpRequest<TArgs> | null>;
};

export type QueryState<TArgs extends QueryArgs> = {
  response: WritableSignal<ResponseType<TArgs> | null>;
  args: WritableSignal<RequestArgs<TArgs> | null>;
  latestHttpEvent: WritableSignal<HttpEvent<ResponseType<TArgs>> | null>;
  loading: WritableSignal<HttpRequestLoadingState | null>;
  error: WritableSignal<QueryErrorResponse | null>;
  lastTimeExecutedAt: WritableSignal<number | null>;
  executionState: Signal<QueryExecutionState<TArgs> | null>;
  subtle: QueryStateSubtle<TArgs>;
};

export type QueryExecutionStateSuccess<TArgs extends QueryArgs> = {
  type: 'success';
  response: ResponseType<TArgs>;
};

export type QueryExecutionStateFailure = {
  type: 'failure';
  error: QueryErrorResponse;
};

export type QueryExecutionStateLoadingWithNoResponse = {
  type: 'loading';
  hasCachedResponse: false;
  loading: HttpRequestLoadingState;
};

export type QueryExecutionStateLoadingWithCachedResponse<TArgs extends QueryArgs> = {
  type: 'loading';
  hasCachedResponse: true;
  loading: HttpRequestLoadingState;
  cachedResponse: ResponseType<TArgs>;
};

export type QueryExecutionStateLoading<TArgs extends QueryArgs> =
  | QueryExecutionStateLoadingWithNoResponse
  | QueryExecutionStateLoadingWithCachedResponse<TArgs>;

export type QueryExecutionState<TArgs extends QueryArgs> =
  | QueryExecutionStateSuccess<TArgs>
  | QueryExecutionStateFailure
  | QueryExecutionStateLoading<TArgs>;

export const setupQueryState = <TArgs extends QueryArgs>(options: SetupQueryStateOptions) => {
  const response = signal<ResponseType<TArgs> | null>(null);
  const args = signal<RequestArgs<TArgs> | null>(null);
  const latestHttpEvent = signal<HttpEvent<ResponseType<TArgs>> | null>(null);
  const error = signal<QueryErrorResponse | null>(null);
  const loading = signal<HttpRequestLoadingState | null>(null);
  const lastTimeExecutedAt = signal<number | null>(null);
  const request = signal<HttpRequest<TArgs> | null>(null);

  const executionState = computed<QueryExecutionState<TArgs> | null>(() => {
    const currentResponse = response();
    const currentError = error();
    const currentLoading = loading();

    if (currentLoading) {
      if (currentResponse) {
        return {
          type: 'loading',
          hasCachedResponse: true,
          loading: currentLoading,
          cachedResponse: currentResponse,
        };
      }

      return {
        type: 'loading',
        hasCachedResponse: false,
        loading: currentLoading,
      };
    } else if (currentError) {
      return {
        type: 'failure',
        error: currentError,
      };
    } else if (currentResponse) {
      return {
        type: 'success',
        response: currentResponse,
      };
    } else {
      return null;
    }
  });

  const state: QueryState<TArgs> = {
    response,
    args,
    latestHttpEvent,
    loading,
    error,
    lastTimeExecutedAt,
    executionState,
    subtle: {
      request,
    },
  };

  return state;
};
