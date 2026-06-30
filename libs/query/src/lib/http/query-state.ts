import { Signal, WritableSignal, computed, linkedSignal, signal } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { HttpRequest, HttpRequestLoadingState, RequestHttpEvent } from './http-request';
import { QueryArgs, RawResponseType, RequestArgs, ResponseType } from './query';
import { QueryErrorResponse } from './query-error-response';

export type SetupQueryStateOptions<TArgs extends QueryArgs> = {
  transformResponse?: (rawResponse: RawResponseType<TArgs>) => ResponseType<TArgs>;
};

export type QueryStateSubtle<TArgs extends QueryArgs> = {
  request: WritableSignal<HttpRequest<TArgs> | null>;
  rawResponse: WritableSignal<RawResponseType<TArgs> | null>;

  /**
   * Forwards the given request's discrete event stream onto the query-level `events$`.
   * Called by `queryExecute` whenever a request is (re-)executed.
   */
  bindRequestEvents: (request: HttpRequest<TArgs>) => void;

  /**
   * Installs the reactive source that backs `state.args`. The `withArgs` feature uses this so that
   * `state.args` always reflects the latest args (pulled from the reactive source on read) instead
   * of being push-updated by an effect that may not have run yet. Without a `withArgs` feature the
   * default source returns `null`.
   */
  setArgsSource: (source: () => RequestArgs<TArgs> | null) => void;
};

export type QueryState<TArgs extends QueryArgs> = {
  rawResponse: WritableSignal<RawResponseType<TArgs> | null>;
  response: Signal<ResponseType<TArgs> | null>;
  args: WritableSignal<RequestArgs<TArgs> | null>;
  latestHttpEvent: WritableSignal<RequestHttpEvent<TArgs> | null>;
  loading: WritableSignal<HttpRequestLoadingState | null>;
  error: WritableSignal<QueryErrorResponse | null>;
  lastTimeExecutedAt: WritableSignal<number | null>;
  lastTriggeredBy: WritableSignal<string | null>;
  executionState: Signal<QueryExecutionState<TArgs> | null>;

  /**
   * A discrete, query-level stream of every request event, fed synchronously from the current
   * request's `events$` at the moment each event occurs. Side-effect features
   * (success/error/logging) subscribe to this instead of edge-detecting on the shared, resettable
   * `response`/`error`/`latestHttpEvent` signals — so they cannot miss a transition when the next
   * execution swaps the underlying request.
   */
  events$: Observable<RequestHttpEvent<TArgs>>;

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

export const setupQueryState = <TArgs extends QueryArgs>(options: SetupQueryStateOptions<TArgs>) => {
  const request = signal<HttpRequest<TArgs> | null>(null);

  const rawResponse = linkedSignal(() => request()?.response() ?? null);
  const response = computed(() => {
    const raw = rawResponse();
    if (raw === null) return null;
    return options.transformResponse ? options.transformResponse(raw) : (raw as ResponseType<TArgs>);
  });
  const loading = linkedSignal(() => request()?.loading() ?? null);
  const error = linkedSignal(() => request()?.error() ?? null);
  const latestHttpEvent = linkedSignal(() => request()?.currentEvent() ?? null);

  // `args` is reactively sourced: reads always reflect the latest value from the installed source
  // (e.g. the `withArgs` feature), so there is no stale window between a source change and an
  // effect writing it. It stays writable (reset / auth-error clear it via `.set(null)`); a manual
  // set is overridden again the next time the source's dependencies change.
  const argsSource = signal<() => RequestArgs<TArgs> | null>(() => null);
  const args = linkedSignal(() => argsSource()());
  const setArgsSource = (source: () => RequestArgs<TArgs> | null) => argsSource.set(source);

  const lastTimeExecutedAt = signal<number | null>(null);
  const lastTriggeredBy = signal<string | null>(null);

  const requestEvents$ = new Subject<RequestHttpEvent<TArgs>>();
  let requestEventsSubscription = Subscription.EMPTY;
  const bindRequestEvents = (request: HttpRequest<TArgs>) => {
    requestEventsSubscription.unsubscribe();
    requestEventsSubscription = request.events$.subscribe((event) => requestEvents$.next(event));
  };

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
    rawResponse,
    response,
    args,
    latestHttpEvent,
    loading,
    error,
    lastTimeExecutedAt,
    lastTriggeredBy,
    executionState,
    events$: requestEvents$.asObservable(),
    subtle: {
      request,
      rawResponse,
      bindRequestEvents,
      setArgsSource,
    },
  };

  return state;
};
