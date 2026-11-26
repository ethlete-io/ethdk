import { Pipe, PipeTransform } from '@angular/core';
import { combineLatest, map } from 'rxjs';
import { suspenseState$, ToolkitSuspenseState } from './suspense.pipe';
import { createToolkitPipeTransform } from './toolkit-pipe-transform';
import { AnyMappedEntityState } from './toolkit-types';

type AnyHandleRecord = Record<string, AnyMappedEntityState | null | undefined>;

export type ToolkitSuspenseMultiState<T extends AnyHandleRecord> = {
  [K in keyof T]: ToolkitSuspenseState<T[K]>;
};

const suspenseMultiState$ = (handles: AnyHandleRecord) =>
  combineLatest(
    Object.entries(handles).flatMap(([key, handle]) =>
      handle ? [suspenseState$(handle).pipe(map((state) => [key, state] as const))] : [],
    ),
  ).pipe(map((states) => Object.fromEntries(states)));

/**
 * Subscribes to a record of toolkit handles and renders each one's current state, like the `suspenseMulti` pipe of
 * `@tomtomb/ngrx-toolkit`. Nothing renders until every non-null handle has emitted.
 */
@Pipe({ name: 'suspenseMulti', pure: false })
export class SuspenseMultiPipe implements PipeTransform {
  transform = createToolkitPipeTransform<AnyHandleRecord, Record<string, unknown>>({
    initialState: {},
    disposedState: {},
    state$: suspenseMultiState$,
  }) as <T extends AnyHandleRecord>(value: T | null | undefined) => ToolkitSuspenseMultiState<T>;
}
