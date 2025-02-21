import { HttpEvent } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
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

  subtle: QueryStateSubtle<TArgs>;
};

export const setupQueryState = <TArgs extends QueryArgs>(options: SetupQueryStateOptions) => {
  const response = signal<ResponseType<TArgs> | null>(null);
  const args = signal<RequestArgs<TArgs> | null>(null);
  const latestHttpEvent = signal<HttpEvent<ResponseType<TArgs>> | null>(null);
  const error = signal<QueryErrorResponse | null>(null);
  const loading = signal<HttpRequestLoadingState | null>(null);
  const lastTimeExecutedAt = signal<number | null>(null);
  const request = signal<HttpRequest<TArgs> | null>(null);

  const state: QueryState<TArgs> = {
    response,
    args,
    latestHttpEvent,
    loading,
    error,
    lastTimeExecutedAt,
    subtle: {
      request,
    },
  };

  return state;
};
