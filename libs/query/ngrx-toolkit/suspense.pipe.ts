import { Pipe, PipeTransform } from '@angular/core';
import { combineLatest, map, Observable, startWith } from 'rxjs';
import { createToolkitPipeTransform } from './toolkit-pipe-transform';
import { AnyMappedEntityState, ToolkitPollingOptions } from './toolkit-types';

type ExtractFrom<T> = T extends Observable<infer U> ? U : never;

/** What `suspense` and `suspenseMulti` render for a handle: every stream's current value, plus the handle's methods. */
export type ToolkitSuspenseState<T extends AnyMappedEntityState | null | undefined> = T extends AnyMappedEntityState
  ? {
      args: ExtractFrom<T['args$']>;
      cachedResponse: ExtractFrom<T['cachedResponse$']> | null;
      callState: ExtractFrom<T['callState$']>;
      error: ExtractFrom<T['error$']>;
      isError: ExtractFrom<T['isError$']>;
      isInit: ExtractFrom<T['isInit$']>;
      isLoading: ExtractFrom<T['isLoading$']>;
      isSuccess: ExtractFrom<T['isSuccess$']>;
      response: ExtractFrom<T['response$']>;
      timestamp: ExtractFrom<T['timestamp$']>;
      refresh: () => void;
      remove: () => void;
      startPolling: (options: ToolkitPollingOptions) => void;
      stopPolling: () => void;
    }
  : T;

type AnySuspenseState = ToolkitSuspenseState<AnyMappedEntityState>;

const noop = () => undefined;

const DEFAULT_STATE: AnySuspenseState = {
  args: null,
  cachedResponse: null,
  callState: null,
  error: null,
  isError: false,
  isInit: false,
  isLoading: false,
  isSuccess: false,
  response: null,
  timestamp: null,
  refresh: noop,
  remove: noop,
  startPolling: noop,
  stopPolling: noop,
};

export const suspenseState$ = (handle: AnyMappedEntityState): Observable<AnySuspenseState> =>
  combineLatest({
    args: handle.args$,
    cachedResponse: handle.cachedResponse$.pipe(startWith(null)),
    callState: handle.callState$,
    error: handle.error$,
    isError: handle.isError$,
    isInit: handle.isInit$,
    isLoading: handle.isLoading$,
    isSuccess: handle.isSuccess$,
    response: handle.response$,
    timestamp: handle.timestamp$,
  }).pipe(
    map((values) => ({
      ...values,
      refresh: handle.refresh,
      remove: handle.remove,
      startPolling: handle.startPolling,
      stopPolling: handle.stopPolling,
    })),
  );

/** Subscribes to a toolkit handle and renders its current state, like the `suspense` pipe of `@tomtomb/ngrx-toolkit`. */
@Pipe({ name: 'suspense', pure: false })
export class SuspensePipe implements PipeTransform {
  transform = createToolkitPipeTransform<AnyMappedEntityState, AnySuspenseState | null>({
    initialState: DEFAULT_STATE,
    disposedState: null,
    state$: suspenseState$,
  }) as <T extends AnyMappedEntityState>(value: T | null | undefined) => ToolkitSuspenseState<T>;
}
