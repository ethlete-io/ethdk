import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { WritableSignal, signal } from '@angular/core';
import { HttpRequestLoadingState } from './http-request';
import { QueryArgs, RequestArgs, ResponseType } from './query';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SetupQueryStateOptions = {};

export type QueryState<TArgs extends QueryArgs> = {
  response: WritableSignal<ResponseType<TArgs> | null>;
  args: WritableSignal<RequestArgs<TArgs> | null>;
  latestHttpEvent: WritableSignal<HttpEvent<ResponseType<TArgs>> | null>;
  loading: WritableSignal<HttpRequestLoadingState | null>;
  error: WritableSignal<HttpErrorResponse | null>;
  lastTimeExecutedAt: WritableSignal<number | null>;
};

export const setupQueryState = <TArgs extends QueryArgs>(options: SetupQueryStateOptions) => {
  const response = signal<ResponseType<TArgs> | null>(null);
  const args = signal<RequestArgs<TArgs> | null>(null);
  const latestHttpEvent = signal<HttpEvent<ResponseType<TArgs>> | null>(null);
  const error = signal<HttpErrorResponse | null>(null);
  const loading = signal<HttpRequestLoadingState | null>(null);
  const lastTimeExecutedAt = signal<number | null>(null);

  const state: QueryState<TArgs> = {
    response,
    args,
    latestHttpEvent,
    loading,
    error,
    lastTimeExecutedAt,
  };

  return state;
};
