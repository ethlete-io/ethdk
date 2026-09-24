import { computed, DestroyRef, effect, EnvironmentInjector, signal, untracked } from '@angular/core';
import {
  AnyQueryCreator,
  QueryArgsOf,
  QueryErrorResponse,
  QueryExecutionState,
  RequestArgs,
  ResponseType,
} from '@ethlete/query';
import {
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  interval,
  map,
  Observable,
  startWith,
  Subject,
  Subscription,
  takeUntil,
} from 'rxjs';
import {
  ActionCallArgs,
  AnyMappedEntityState,
  CallState,
  MappedEntityState,
  ToolkitError,
  ToolkitPollingOptions,
} from './toolkit-types';

type ToolkitHandleSnapshot = {
  args: unknown;
  callState: CallState | null;
  response: unknown;
  error: ToolkitError | null;
  timestamp: number | null;
};

export type ToolkitHandleEntry = {
  handle: AnyMappedEntityState;
  call: () => void;
};

const EMPTY_SNAPSHOT: ToolkitHandleSnapshot = {
  args: null,
  callState: null,
  response: null,
  error: null,
  timestamp: null,
};

const toCallState = (state: QueryExecutionState<never> | null): CallState => {
  switch (state?.type) {
    case 'success':
      return CallState.SUCCESS;
    case 'failure':
      return CallState.ERROR;
    default:
      return CallState.LOADING;
  }
};

const toToolkitError = (error: QueryErrorResponse): ToolkitError => ({
  status: error.raw.status,
  message: error.raw.message,
  data: error.raw.error ?? null,
});

const toQueryArgs = (args: Record<string, unknown>) => {
  const actionOptions = args['actionOptions'] as { headers?: unknown } | undefined;
  const queryArgs: Record<string, unknown> = {};

  if (args['queryParams'] !== undefined) queryArgs['pathParams'] = args['queryParams'];
  if (args['params'] !== undefined) queryArgs['queryParams'] = args['params'];
  if (args['body'] !== undefined) queryArgs['body'] = args['body'];
  if (actionOptions?.headers !== undefined) queryArgs['headers'] = actionOptions.headers;

  return queryArgs as RequestArgs<never>;
};

export const createToolkitHandle = <TCreator extends AnyQueryCreator>(
  creator: TCreator,
  args: ActionCallArgs<TCreator>,
  injector: EnvironmentInjector,
): ToolkitHandleEntry => {
  const query = creator({ injector, onlyManualExecution: true, silenceMissingWithArgsFeatureError: true });
  const queryArgs = toQueryArgs(args as Record<string, unknown>);

  const calledArgs = signal<ActionCallArgs<TCreator> | null>(null);
  const toolkitError = computed(() => {
    const error = query.error();

    return error ? toToolkitError(error) : null;
  });
  const snapshot = computed<ToolkitHandleSnapshot>(() => {
    const currentArgs = calledArgs();

    if (!currentArgs) return EMPTY_SNAPSHOT;

    const state = query.executionState();
    const callState = toCallState(state);

    return {
      args: currentArgs,
      callState,
      response: state?.type === 'success' ? state.response : null,
      error: callState === CallState.ERROR ? toolkitError() : null,
      timestamp: Date.now(),
    };
  });

  const changes = new Subject<ToolkitHandleSnapshot>();

  effect(
    () => {
      const current = snapshot();
      untracked(() => changes.next(current));
    },
    { injector },
  );

  const select = <T>(pick: (current: ToolkitHandleSnapshot) => T): Observable<T> =>
    defer(() => changes.pipe(startWith(untracked(snapshot)))).pipe(map(pick), distinctUntilChanged());

  const call = () => {
    calledArgs.set(args);
    query.execute({ args: queryArgs });
  };

  const refresh = () => {
    if (untracked(calledArgs)) call();
  };

  let pollingSubscription = Subscription.EMPTY;

  const stopPolling = () => pollingSubscription.unsubscribe();

  const startPolling = ({ intervalDuration, killSwitch }: ToolkitPollingOptions) => {
    if (!pollingSubscription.closed) return;

    pollingSubscription = interval(intervalDuration)
      .pipe(
        takeUntil(killSwitch),
        finalize(() => (pollingSubscription = Subscription.EMPTY)),
      )
      .subscribe(() => refresh());
  };

  const remove = () => {
    stopPolling();
    calledArgs.set(null);
    query.reset();
  };

  injector.get(DestroyRef).onDestroy(() => {
    stopPolling();
    changes.complete();
  });

  type TResponse = ResponseType<QueryArgsOf<TCreator>>;

  const response$ = select((current) => current.response as TResponse | null);

  const handle: MappedEntityState<TCreator> = {
    response$,
    cachedResponse$: response$.pipe(filter((response): response is TResponse => !!response)),
    error$: select((current) => current.error),
    args$: select((current) => current.args as ActionCallArgs<TCreator> | null),
    isInit$: select((current) => current.callState === CallState.INIT),
    isLoading$: select((current) => current.callState === CallState.LOADING),
    isSuccess$: select((current) => current.callState === CallState.SUCCESS),
    isError$: select((current) => current.callState === CallState.ERROR),
    timestamp$: select((current) => current.timestamp),
    callState$: select((current) => current.callState),
    refresh,
    remove,
    startPolling,
    stopPolling,
  };

  return { handle, call };
};
